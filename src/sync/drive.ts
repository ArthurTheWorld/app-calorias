/** Arquivo do banco no Drive: id e a revisão do conteúdo (`headRevisionId`, só muda quando o conteúdo muda). */
export interface Remoto { id: string; version: string }

/** O que a sincronização precisa do Drive. Os testes usam um Drive em memória. */
export interface ClienteDrive {
  /** Procura o arquivo do app (primeira conexão ou estado perdido). */
  procurar(): Promise<Remoto | null>
  /** Metadados pelo id; null se não existe mais ou foi para a lixeira. */
  meta(id: string): Promise<Remoto | null>
  baixar(id: string): Promise<Uint8Array>
  /** Cria o arquivo (e a pasta, se preciso). */
  criar(dados: Uint8Array): Promise<Remoto>
  atualizar(id: string, dados: Uint8Array): Promise<Remoto>
}

export const PASTA = 'App Calorias'
export const ARQUIVO = 'app-calorias.sqlite'
const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const PASTA_MIME = 'application/vnd.google-apps.folder'
const SQLITE_MIME = 'application/vnd.sqlite3'
const CAMPOS = 'id,headRevisionId'

type Bruto = { id: string; headRevisionId?: string; trashed?: boolean }
const comoRemoto = (r: Bruto): Remoto => ({ id: r.id, version: r.headRevisionId ?? '' })

export class ErroDrive extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

/** Cliente da API REST v3 do Drive com um token de acesso (escopo drive.file). */
export function clienteDrive(token: string, f: typeof fetch = (...a) => fetch(...a)): ClienteDrive {
  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await f(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new ErroDrive(r.status, `Drive respondeu ${r.status}`)
    return r
  }
  const json = async <T>(url: string, init?: RequestInit) => (await pedir(url, init)).json() as Promise<T>
  const busca = (q: string) => `${API}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(${CAMPOS})&orderBy=modifiedTime desc`

  async function idDaPasta(): Promise<string> {
    const { files } = await json<{ files: Bruto[] }>(busca(`name = '${PASTA}' and mimeType = '${PASTA_MIME}' and trashed = false`))
    if (files[0]) return files[0].id
    const nova = await json<Bruto>(`${API}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: PASTA, mimeType: PASTA_MIME }),
    })
    return nova.id
  }

  return {
    async procurar() {
      const { files } = await json<{ files: Bruto[] }>(busca(`name = '${ARQUIVO}' and trashed = false`))
      return files[0] ? comoRemoto(files[0]) : null
    },
    async meta(id) {
      try {
        const r = await json<Bruto>(`${API}/${id}?fields=${CAMPOS},trashed`)
        return r.trashed ? null : comoRemoto(r)
      } catch (e) {
        if (e instanceof ErroDrive && e.status === 404) return null
        throw e
      }
    },
    async baixar(id) {
      return new Uint8Array(await (await pedir(`${API}/${id}?alt=media`)).arrayBuffer())
    },
    async criar(dados) {
      const pasta = await idDaPasta()
      // Upload multipart/related, como a documentação do Drive pede.
      const limite = `app-calorias-${Math.random().toString(36).slice(2)}`
      const meta = JSON.stringify({ name: ARQUIVO, parents: [pasta], mimeType: SQLITE_MIME })
      const corpo = new Blob([
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
        `--${limite}\r\nContent-Type: ${SQLITE_MIME}\r\n\r\n`,
        dados as BlobPart,
        `\r\n--${limite}--`,
      ])
      return comoRemoto(await json<Bruto>(`${UPLOAD}?uploadType=multipart&fields=${CAMPOS}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
        body: corpo,
      }))
    },
    async atualizar(id, dados) {
      return comoRemoto(await json<Bruto>(`${UPLOAD}/${id}?uploadType=media&fields=${CAMPOS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': SQLITE_MIME },
        body: new Blob([dados as BlobPart], { type: SQLITE_MIME }),
      }))
    },
  }
}
