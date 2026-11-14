import type { RegistroPeso } from '../db/repos'
import type { Perfil } from './energia'

/**
 * Peso que valia num dia: o último registro com data ≤ dia; antes do primeiro registro, o primeiro.
 * `pesos` em ordem crescente de data. Lista vazia → null.
 */
export function pesoNaData(pesos: RegistroPeso[], data: string): number | null {
  if (pesos.length === 0) return null
  let peso = pesos[0].pesoKg
  for (const p of pesos) {
    if (p.data > data) break
    peso = p.pesoKg
  }
  return peso
}

/** O perfil com o peso daquele dia (sem registros, o peso do próprio perfil). */
export function perfilNaData(perfil: Perfil, pesos: RegistroPeso[], data: string): Perfil {
  return { ...perfil, pesoKg: pesoNaData(pesos, data) ?? perfil.pesoKg }
}
