import { expect, test } from 'vitest'
import { gastoDia } from './energia'
import { resumirDias } from './historico'
import { perfilNaData, pesoNaData } from './peso'

const p = { alturaCm: 178, pesoKg: 70, idade: 30, sexo: 'M' as const, deficitMeta: 500 }
const pesos = [{ id: 1, data: '2026-11-05', pesoKg: 82 }, { id: 2, data: '2026-11-10', pesoKg: 80 }]

test('peso na data: antes do primeiro, entre registros e depois do último', () => {
  expect(pesoNaData(pesos, '2026-11-01')).toBe(82)
  expect(pesoNaData(pesos, '2026-11-09')).toBe(82)
  expect(pesoNaData(pesos, '2026-11-10')).toBe(80)
  expect(pesoNaData(pesos, '2026-11-20')).toBe(80)
  expect(pesoNaData([], '2026-11-20')).toBeNull()
})

test('perfil na data usa o peso do dia; sem registros, o do perfil', () => {
  expect(perfilNaData(p, pesos, '2026-11-06').pesoKg).toBe(82)
  expect(perfilNaData(p, [], '2026-11-06').pesoKg).toBe(70)
})

test('déficit antigo não muda ao registrar um peso novo', () => {
  const totais = [{ data: '2026-11-06', consumido: 1500, treinos: 0 }]
  const antes = resumirDias(p, totais, pesos)[0]
  expect(antes.gasto).toBeCloseTo(gastoDia({ ...p, pesoKg: 82 }, 0))
  const depois = resumirDias(p, totais, [...pesos, { id: 3, data: '2026-11-12', pesoKg: 79 }])[0]
  expect(depois.gasto).toBeCloseTo(antes.gasto)
})
