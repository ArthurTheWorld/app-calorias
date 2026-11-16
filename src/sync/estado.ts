import { del, get, set } from 'idb-keyval'

/** O que o aparelho sabe da última sincronização com o Drive. */
export interface EstadoSync {
  fileId: string | null
  /** Campo `version` do arquivo no Drive na última vez que enviamos ou baixamos. */
  versaoRemota: string | null
  /** Contador de gravações local que já está no Drive. */
  seqSincronizado: number
  /** ISO da última sincronização bem-sucedida. */
  ultima: string | null
}

const CHAVE = 'sync-drive'
const PADRAO: EstadoSync = { fileId: null, versaoRemota: null, seqSincronizado: 0, ultima: null }

export async function lerEstadoSync(): Promise<EstadoSync> {
  return { ...PADRAO, ...((await get<Partial<EstadoSync>>(CHAVE)) ?? {}) }
}

export async function gravarEstadoSync(parcial: Partial<EstadoSync>): Promise<void> {
  await set(CHAVE, { ...(await lerEstadoSync()), ...parcial })
}

export async function limparEstadoSync(): Promise<void> {
  await del(CHAVE)
}
