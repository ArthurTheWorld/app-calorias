import type { DiaJogo } from '../db/repos'
import { diasEntre } from './datas'

/** Dia registrado = pelo menos uma refeição. */
export const registrado = (d: DiaJogo): boolean => d.consumido > 0

/** XP vem só de registrar, nunca do resultado. */
export function xpDoDia(d: DiaJogo): number {
  const tipos = Object.keys(d.kcalPorTipo).length
  return (registrado(d) ? 10 : 0) + 5 * tipos + (d.qtdTreinos > 0 ? 15 : 0)
}

export const xpTotal = (dias: DiaJogo[]): number => dias.reduce((s, d) => s + xpDoDia(d), 0)

const inicioNivel = (n: number) => 50 * n * (n - 1)

/** Nível n começa em 50·n·(n−1) XP; o nível n dura 100·n XP. */
export function nivel(xp: number): { nivel: number; xpNoNivel: number; xpDoNivel: number } {
  let n = 1
  while (inicioNivel(n + 1) <= xp) n++
  return { nivel: n, xpNoNivel: xp - inicioNivel(n), xpDoNivel: 100 * n }
}

/** Dias corridos desde o primeiro dia registrado (o primeiro é o Dia 1). */
export function diaN(dias: DiaJogo[], hoje: string): number {
  const primeiro = dias.find(registrado)
  return primeiro ? diasEntre(primeiro.data, hoje) + 1 : 1
}
