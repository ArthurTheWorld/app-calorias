import { somarDias } from './datas'
import { gastoDia, type Perfil } from './energia'
import { perfilNaData } from './peso'
import type { RegistroPeso } from '../db/repos'

export interface DiaResumo {
  data: string
  consumido: number
  gasto: number
  deficit: number
  emDeficit: boolean
}

export interface ResumoMes {
  diasRegistrados: number
  diasEmDeficit: number
  deficitTotal: number
  mediaConsumo: number
}

/** Só dias com alguma refeição registrada entram no histórico. Cada dia usa o peso da sua data. */
export function resumirDias(
  p: Perfil,
  totais: { data: string; consumido: number; treinos: number }[],
  pesos: RegistroPeso[] = [],
): DiaResumo[] {
  return totais
    .filter((t) => t.consumido > 0)
    .map((t) => {
      const gasto = gastoDia(perfilNaData(p, pesos, t.data), t.treinos)
      return { data: t.data, consumido: t.consumido, gasto, deficit: gasto - t.consumido, emDeficit: t.consumido < gasto }
    })
}

/**
 * Sequência de dias consecutivos em déficit.
 * atual: termina hoje, ou ontem se hoje ainda não tem registro.
 */
export function streak(dias: DiaResumo[], hoje: string): { atual: number; recorde: number } {
  const porData = new Map(dias.map((d) => [d.data, d]))
  const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data))

  let recorde = 0
  let corrida = 0
  let anterior: string | null = null
  for (const d of ordenados) {
    if (!d.emDeficit) { corrida = 0; anterior = d.data; continue }
    corrida = anterior !== null && somarDias(anterior, 1) === d.data && porData.get(anterior)?.emDeficit ? corrida + 1 : 1
    recorde = Math.max(recorde, corrida)
    anterior = d.data
  }

  let atual = 0
  let cursor = porData.has(hoje) ? hoje : somarDias(hoje, -1)
  while (porData.get(cursor)?.emDeficit) {
    atual++
    cursor = somarDias(cursor, -1)
  }
  return { atual, recorde }
}

export function resumoMes(dias: DiaResumo[], mes: string): ResumoMes {
  const doMes = dias.filter((d) => d.data.startsWith(mes + '-'))
  const n = doMes.length
  return {
    diasRegistrados: n,
    diasEmDeficit: doMes.filter((d) => d.emDeficit).length,
    deficitTotal: doMes.reduce((s, d) => s + d.deficit, 0),
    mediaConsumo: n ? doMes.reduce((s, d) => s + d.consumido, 0) / n : 0,
  }
}
