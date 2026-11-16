import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBanco } from '../estado'
import { CLIENT_ID } from './config'
import { clienteDrive, ErroDrive, type ClienteDrive } from './drive'
import { limparEstadoSync, lerEstadoSync } from './estado'
import { esquecerToken, pedirToken, prepararGoogle, tokenValido } from './google'
import { sincronizar, type Escolha } from './motor'

/** Dependências externas (Google e Drive); os testes trocam por falsas. */
export interface DepsSync {
  clienteId: string
  token(): string | null
  /** Carrega o login do Google antes de qualquer toque. */
  preparar(): Promise<void>
  pedirToken(prompt: '' | 'consent'): Promise<string>
  esquecerToken(): void
  cliente(token: string): ClienteDrive
  recarregar(): void
  esperaMs: number
}

export const DEPS_REAIS: DepsSync = {
  clienteId: CLIENT_ID,
  token: () => tokenValido(),
  preparar: prepararGoogle,
  pedirToken,
  esquecerToken,
  cliente: (t) => clienteDrive(t),
  recarregar: () => window.location.reload(),
  esperaMs: 4000,
}

export interface Sync {
  /** Há Client ID configurado (senão nada de Drive aparece). */
  ativo: boolean
  conectado: boolean
  precisaToque: boolean
  conflito: boolean
  /** O arquivo conhecido não existe mais no Drive. */
  sumiu: boolean
  ocupado: boolean
  ultima: string | null
  msg: string | null
  conectar(): Promise<void>
  sincronizarAgora(): Promise<void>
  resolver(lado: 'drive' | 'celular'): Promise<void>
  recriar(): Promise<void>
  desconectar(): Promise<void>
}

const CHAVE_CONECTADO = 'drive-conectado'
const CHAVE_MSG = 'sync-msg'
const MSG_FALHA = 'Não deu para sincronizar agora. Tente de novo mais tarde.'
const MSG_LOGIN = 'Não deu para entrar no Google agora.'

const INATIVO: Sync = {
  ativo: false, conectado: false, precisaToque: false, conflito: false, sumiu: false, ocupado: false, ultima: null, msg: null,
  conectar: async () => {}, sincronizarAgora: async () => {}, resolver: async () => {}, recriar: async () => {}, desconectar: async () => {},
}

const Ctx = createContext<Sync>(INATIVO)
export const useSync = () => useContext(Ctx)

export function ProvedorSync({ deps = DEPS_REAIS, children }: { deps?: DepsSync; children: ReactNode }) {
  const { banco, versao } = useBanco()
  const ativo = deps.clienteId !== ''
  const [conectado, setConectado] = useState(() => ativo && localStorage.getItem(CHAVE_CONECTADO) === '1')
  const [precisaToque, setPrecisaToque] = useState(false)
  const [conflito, setConflito] = useState(false)
  const [sumiu, setSumiu] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [ultima, setUltima] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(() => {
    const m = sessionStorage.getItem(CHAVE_MSG)
    sessionStorage.removeItem(CHAVE_MSG)
    return m
  })
  const rodando = useRef(false)
  /** Pedido que chegou durante uma rodada: roda de novo no fim. */
  const pendente = useRef(false)
  const parado = useRef(false)

  /** Uma rodada com o token atual. Sem token, só marca que precisa de um toque (nunca abre janela sozinho). */
  const rodar = useCallback(async function rodada(escolha?: Escolha): Promise<void> {
    if (rodando.current) { pendente.current = true; return }
    const token = deps.token()
    if (!token) { setPrecisaToque(true); return }
    rodando.current = true
    pendente.current = false
    setOcupado(true)
    let repetir = false
    try {
      const r = await sincronizar(banco, deps.cliente(token), escolha)
      setPrecisaToque(false)
      setSumiu(r.tipo === 'sumiu')
      setConflito(r.tipo === 'conflito')
      if (r.tipo === 'sumiu' || r.tipo === 'conflito') return
      setUltima((await lerEstadoSync()).ultima)
      if (r.tipo === 'baixado') {
        parado.current = true
        sessionStorage.setItem(CHAVE_MSG, 'Atualizado com a versão do Drive.')
        deps.recarregar()
        return
      }
      setMsg((m) => (m === MSG_FALHA ? null : m))
      repetir = pendente.current
    } catch (e) {
      if (e instanceof ErroDrive && (e.status === 401 || e.status === 403)) { deps.esquecerToken(); setPrecisaToque(true) }
      else setMsg(MSG_FALHA)
    } finally {
      rodando.current = false
      pendente.current = false
      setOcupado(false)
    }
    if (repetir && !parado.current) await rodada()
  }, [banco, deps])

  /** A partir de um toque: renova o token se precisar (pedido sai já, dentro do toque) e sincroniza. */
  const comToque = useCallback(async (escolha?: Escolha) => {
    if (!deps.token()) {
      try { await deps.pedirToken('') } catch (e) { setMsg(e instanceof Error && e.message ? e.message : MSG_LOGIN); return }
    }
    await rodar(escolha)
  }, [deps, rodar])

  // Com Client ID: carrega o login do Google já na abertura.
  useEffect(() => {
    if (ativo) deps.preparar().catch(() => {})
  }, [ativo, deps])

  // Ao abrir: confere o Drive (ou pede o toque).
  useEffect(() => {
    if (!conectado) return
    lerEstadoSync().then((e) => setUltima(e.ultima))
    rodar()
  }, [conectado]) // eslint-disable-line react-hooks/exhaustive-deps

  // Depois de cada gravação: espera um pouco e envia.
  const ultimaVersao = useRef(versao)
  useEffect(() => {
    if (ultimaVersao.current === versao) return
    ultimaVersao.current = versao
    if (!conectado || conflito || sumiu) return
    const t = setTimeout(() => rodar(), deps.esperaMs)
    return () => clearTimeout(t)
  }, [versao]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ativo) return <Ctx.Provider value={INATIVO}>{children}</Ctx.Provider>
  const valor: Sync = {
    ativo, conectado, precisaToque: conectado && precisaToque, conflito, sumiu, ocupado, ultima, msg,
    async conectar() {
      try { await deps.pedirToken('consent') } catch (e) { setMsg(e instanceof Error && e.message ? e.message : MSG_LOGIN); return }
      localStorage.setItem(CHAVE_CONECTADO, '1')
      setConectado(true) // o efeito de abertura roda a primeira sincronização
    },
    sincronizarAgora: () => comToque(),
    resolver: (lado) => comToque(lado),
    recriar: () => comToque('recriar'),
    async desconectar() {
      localStorage.removeItem(CHAVE_CONECTADO)
      deps.esquecerToken()
      await limparEstadoSync()
      setConectado(false)
      setConflito(false)
      setSumiu(false)
      setPrecisaToque(false)
      setUltima(null)
    },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
