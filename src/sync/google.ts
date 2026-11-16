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
interface Gis {
  accounts: { oauth2: { initTokenClient(c: {
    client_id: string
    scope: string
    callback: (r: RespostaToken) => void
    error_callback?: (e: { type: string }) => void
  }): { requestAccessToken(o: { prompt: string }): void } } }
}

let script: Promise<Gis> | null = null
function carregarGis(): Promise<Gis> {
  script ??= new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok((window as unknown as { google: Gis }).google)
    s.onerror = () => { script = null; falha(new Error('Não deu para carregar o login do Google.')) }
    document.head.appendChild(s)
  })
  return script
}

/**
 * Pede um token ao Google. Chamar só a partir de um toque (o navegador bloqueia a janela sem gesto).
 * `consent` na primeira conexão; `''` para renovar sem perguntar de novo.
 */
export async function pedirToken(prompt: '' | 'consent'): Promise<string> {
  const gis = await carregarGis()
  return new Promise((ok, falha) => {
    const cliente = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: ESCOPO_DRIVE,
      callback: (r) => {
        if (!r.access_token) return falha(new Error(r.error ?? 'Login cancelado.'))
        guardarToken(r.access_token, r.expires_in ?? 3600)
        ok(r.access_token)
      },
      error_callback: (e) => falha(new Error(e.type === 'popup_closed' ? 'Login cancelado.' : 'Não deu para entrar no Google.')),
    })
    cliente.requestAccessToken({ prompt })
  })
}
