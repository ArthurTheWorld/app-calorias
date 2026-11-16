import type { Remoto } from './drive'
import type { EstadoSync } from './estado'

export type Acao = 'criar' | 'baixar' | 'enviar' | 'conflito' | 'nada'

/** O que fazer comparando o Drive e o aparelho com a última sincronização. */
export function decidir({ remoto, estado, seqLocal }: { remoto: Remoto | null; estado: EstadoSync; seqLocal: number }): Acao {
  if (remoto === null) return 'criar'
  const remotoMudou = remoto.version !== estado.versaoRemota
  const localMudou = seqLocal > estado.seqSincronizado
  if (remotoMudou && localMudou) return 'conflito'
  if (remotoMudou) return 'baixar'
  if (localMudou) return 'enviar'
  return 'nada'
}
