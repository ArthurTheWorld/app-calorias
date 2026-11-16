/** Arquivo do banco no Drive: id e o campo `version` (sobe a cada escrita, de qualquer lado). */
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
  const busca = (q: string) => `${API}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,version)&orderBy=modifiedTime desc`

  async function idDaPasta(criarSeFaltar: boolean): Promise<string | null> {
    const { files } = await json<{ files: Remoto[] }>(busca(`name = '${PASTA}' and mimeType = '${PASTA_MIME}' and trashed = false`))
    if (files[0]) return files[0].id
    if (!criarSeFaltar) return null
    const nova = await json<Remoto>(`${API}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: PASTA, mimeType: PASTA_MIME }),
    })
    return nova.id
  }

  return {
    async procurar() {
      const { files } = await json<{ files: Remoto[] }>(busca(`name = '${ARQUIVO}' and trashed = false`))
      return files[0] ?? null
    },
    async meta(id) {
      try {
        const r = await json<Remoto & { trashed: boolean }>(`${API}/${id}?fields=id,version,trashed`)
        return r.trashed ? null : { id: r.id, version: r.version }
      } catch (e) {
        if (e instanceof ErroDrive && e.status === 404) return null
        throw e
      }
    },
    async baixar(id) {
      return new Uint8Array(await (await pedir(`${API}/${id}?alt=media`)).arrayBuffer())
    },
    async criar(dados) {
      const pasta = await idDaPasta(true)
      const corpo = new FormData()
      corpo.append('metadata', new Blob([JSON.stringify({ name: ARQUIVO, parents: [pasta], mimeType: SQLITE_MIME })], { type: 'application/json' }))
      corpo.append('file', new Blob([dados as BlobPart], { type: SQLITE_MIME }))
      return json<Remoto>(`${UPLOAD}?uploadType=multipart&fields=id,version`, { method: 'POST', body: corpo })
    },
    async atualizar(id, dados) {
      return json<Remoto>(`${UPLOAD}/${id}?uploadType=media&fields=id,version`, {
        method: 'PATCH',
        headers: { 'Content-Type': SQLITE_MIME },
        body: new Blob([dados as BlobPart], { type: SQLITE_MIME }),
      })
    },
  }
}
