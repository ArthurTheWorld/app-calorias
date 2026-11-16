import { CLIENT_ID, ESCOPO_DRIVE } from './config'

/** Token de acesso do Google (vale ~1 hora). Fica neste aparelho; o escopo só alcança os arquivos do app. */
const CHAVE = 'drive-token'
const MARGEM_MS = 60_000

export function guardarToken(token: string, expiraEmSeg: number, agora = Date.now()): void {
  localStorage.setItem(CHAVE, JSON.stringify({ token, expira: agora + expiraEmSeg * 1000 }))
}

/** O token, se ainda vale por mais de 1 minuto; senão null. */
export function tokenValido(agora = Date.now()): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as { token: string; expira: number } | null
    return t && t.expira - MARGEM_MS > agora ? t.token : null
  } catch {
    return null
  }
}

export function esquecerToken(): void {
  localStorage.removeItem(CHAVE)
}

interface RespostaToken { access_token?: string; expires_in?: number; error?: string }
interface ClienteToken { requestAccessToken(o: { prompt: string }): void }
interface Gis {
  accounts: { oauth2: {
    initTokenClient(c: {
      client_id: string
      scope: string
      callback: (r: RespostaToken) => void
      error_callback?: (e: { type: string }) => void
    }): ClienteToken
    hasGrantedAllScopes(r: RespostaToken, ...escopos: string[]): boolean
  } }
}

const gisDaJanela = () => (window as unknown as { google?: Gis }).google

let script: Promise<Gis> | null = null
function carregarGis(): Promise<Gis> {
  const ja = gisDaJanela()
  if (ja?.accounts?.oauth2) return Promise.resolve(ja)
  script ??= new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok(gisDaJanela()!)
    s.onerror = () => { script = null; falha(new Error('Não deu para carregar o login do Google.')) }
    document.head.appendChild(s)
  })
  return script
}

/** Pedido em andamento: o callback do Google resolve este. */
let pendente: { ok: (t: string) => void; falha: (e: Error) => void } | null = null
let cliente: ClienteToken | null = null

/**
 * Carrega o script do Google e cria o cliente de token antes de qualquer toque,
 * para o pedido sair na hora do toque (navegadores bloqueiam a janela depois de esperas).
 */
export async function prepararGoogle(): Promise<void> {
  const gis = await carregarGis()
  cliente = gis.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: ESCOPO_DRIVE,
    callback: (r) => {
      const p = pendente
      pendente = null
      if (!p) return
      if (!r.access_token) return p.falha(new Error('Login cancelado.'))
      if (!gis.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO_DRIVE)) {
        return p.falha(new Error('Permita o acesso ao Google Drive para sincronizar.'))
      }
      guardarToken(r.access_token, r.expires_in ?? 3600)
      p.ok(r.access_token)
    },
    error_callback: (e) => {
      const p = pendente
      pendente = null
      p?.falha(new Error(e.type === 'popup_closed' ? 'Login cancelado.' : 'Não deu para entrar no Google.'))
    },
  })
}

/**
 * Pede um token ao Google. Chamar só a partir de um toque.
 * `consent` na primeira conexão; `''` para renovar sem perguntar de novo.
 */
export function pedirToken(prompt: '' | 'consent'): Promise<string> {
  const promessa = new Promise<string>((ok, falha) => { pendente?.falha(new Error('Login cancelado.')); pendente = { ok, falha } })
  if (cliente) cliente.requestAccessToken({ prompt }) // síncrono: ainda dentro do toque
  else prepararGoogle().then(() => cliente!.requestAccessToken({ prompt }), (e: Error) => { pendente?.falha(e); pendente = null })
  return promessa
}
