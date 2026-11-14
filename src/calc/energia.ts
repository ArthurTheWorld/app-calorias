export type Sexo = 'M' | 'F'

export interface Perfil {
  alturaCm: number
  pesoKg: number
  idade: number
  sexo: Sexo
  deficitMeta: number
}

export const FATOR_ATIVIDADE = 1.2
export const DEFICIT_PADRAO = 500

/** Gasto basal (Mifflin-St Jeor), em kcal/dia. */
export function tmb(p: Perfil): number {
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.idade
  return p.sexo === 'M' ? base + 5 : base - 161
}

/** Gasto total do dia: basal × fator de atividade + treinos. */
export function gastoDia(p: Perfil, kcalTreinos: number): number {
  return tmb(p) * FATOR_ATIVIDADE + kcalTreinos
}

/** Quanto comer no dia para bater o déficit — nunca abaixo do basal. */
export function metaConsumo(p: Perfil, kcalTreinos: number): number {
  return Math.max(gastoDia(p, kcalTreinos) - p.deficitMeta, tmb(p))
}

export function kcalTreino(met: number, pesoKg: number, duracaoMin: number): number {
  return Math.round(met * pesoKg * (duracaoMin / 60))
}
