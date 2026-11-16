import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBanco } from '../estado'
import { CLIENT_ID } from './config'
import { clienteDrive, ErroDrive, type ClienteDrive } from './drive'
import { limparEstadoSync, lerEstadoSync } from './estado'
import { esquecerToken, pedirToken, tokenValido } from './google'
import { sincronizar } from './motor'

/** Dependências externas (Google e Drive); os testes trocam por falsas. */
export interface DepsSync {
  clienteId: string
  token(): string | null
  pedirToken(prompt: '' | 'consent'): Promise<string>
  esquecerToken(): void
  cliente(token: string): ClienteDrive
  recarregar(): void
  esperaMs: number
}

export const DEPS_REAIS: DepsSync = {
  clienteId: CLIENT_ID,
  token: () => tokenValido(),
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
  ocupado: boolean
  ultima: string | null
  msg: string | null
  conectar(): Promise<void>
  sincronizarAgora(): Promise<void>
  resolver(lado: 'drive' | 'celular'): Promise<void>
  desconectar(): Promise<void>
}

const CHAVE_CONECTADO = 'drive-conectado'
const CHAVE_MSG = 'sync-msg'
const MSG_FALHA = 'Não deu para sincronizar agora. Tente de novo mais tarde.'

const INATIVO: Sync = {
  ativo: false, conectado: false, precisaToque: false, conflito: false, ocupado: false, ultima: null, msg: null,
  conectar: async () => {}, sincronizarAgora: async () => {}, resolver: async () => {}, desconectar: async () => {},
}

const Ctx = createContext<Sync>(INATIVO)
export const useSync = () => useContext(Ctx)

export function ProvedorSync({ deps = DEPS_REAIS, children }: { deps?: DepsSync; children: ReactNode }) {
  const { banco, versao } = useBanco()
  const ativo = deps.clienteId !== ''
  const [conectado, setConectado] = useState(() => ativo && localStorage.getItem(CHAVE_CONECTADO) === '1')
  const [precisaToque, setPrecisaToque] = useState(false)
  const [conflito, setConflito] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [ultima, setUltima] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(() => {
    const m = sessionStorage.getItem(CHAVE_MSG)
    sessionStorage.removeItem(CHAVE_MSG)
    return m
  })
  const rodando = useRef(false)

  /** Uma rodada com o token atual. Sem token, só marca que precisa de um toque (nunca abre janela sozinho). */
  const rodar = useCallback(async (resolver?: 'drive' | 'celular') => {
    if (rodando.current) return
    const token = deps.token()
    if (!token) { setPrecisaToque(true); return }
    rodando.current = true
    setOcupado(true)
    try {
      const r = await sincronizar(banco, deps.cliente(token), resolver)
      setPrecisaToque(false)
      if (r.tipo === 'conflito') { setConflito(true); return }
      setConflito(false)
      setUltima((await lerEstadoSync()).ultima)
      if (r.tipo === 'baixado') {
        sessionStorage.setItem(CHAVE_MSG, 'Atualizado com a versão do Drive.')
        deps.recarregar()
      } else setMsg((m) => (m === MSG_FALHA ? null : m))
    } catch (e) {
      if (e instanceof ErroDrive && e.status === 401) { deps.esquecerToken(); setPrecisaToque(true) }
      else setMsg(MSG_FALHA)
    } finally {
      rodando.current = false
      setOcupado(false)
    }
  }, [banco, deps])

  /** A partir de um toque: renova o token se precisar e sincroniza. */
  const comToque = useCallback(async (prompt: '' | 'consent', resolver?: 'drive' | 'celular') => {
    if (prompt === 'consent' || !deps.token()) {
      try { await deps.pedirToken(prompt) } catch { setMsg('Não deu para entrar no Google agora.'); return }
    }
    await rodar(resolver)
  }, [deps, rodar])

  // Ao abrir: confere o Drive (ou pede o toque).
  useEffect(() => {
    if (!conectado) return
    lerEstadoSync().then((e) => setUltima(e.ultima))
    rodar()
  }, [conectado]) // eslint-disable-line react-hooks/exhaustive-deps

  // Depois de cada gravação: espera um pouco e envia.
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    if (!conectado || conflito) return
    const t = setTimeout(() => rodar(), deps.esperaMs)
    return () => clearTimeout(t)
  }, [versao]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ativo) return <Ctx.Provider value={INATIVO}>{children}</Ctx.Provider>
  const valor: Sync = {
    ativo, conectado, precisaToque: conectado && precisaToque, conflito, ocupado, ultima, msg,
    async conectar() {
      try { await deps.pedirToken('consent') } catch { setMsg('Não deu para entrar no Google agora.'); return }
      localStorage.setItem(CHAVE_CONECTADO, '1')
      setConectado(true) // o efeito de abertura roda a primeira sincronização
    },
    sincronizarAgora: () => comToque(''),
    resolver: (lado) => comToque('', lado),
    async desconectar() {
      localStorage.removeItem(CHAVE_CONECTADO)
      deps.esquecerToken()
      await limparEstadoSync()
      setConectado(false)
      setConflito(false)
      setPrecisaToque(false)
      setUltima(null)
    },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
