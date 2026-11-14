import { describe, expect, test } from 'vitest'
import { gastoDia, kcalTreino, metaConsumo, tmb, type Perfil } from './energia'

const p: Perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 500 }

describe('energia', () => {
  test('tmb homem', () => expect(tmb(p)).toBeCloseTo(1773.75))
  test('tmb mulher', () => expect(tmb({ ...p, sexo: 'F' })).toBeCloseTo(1607.75))
  test('gasto com treino', () => expect(gastoDia(p, 300)).toBeCloseTo(1773.75 * 1.2 + 300))
  test('meta normal', () => expect(metaConsumo(p, 300)).toBeCloseTo(1773.75 * 1.2 + 300 - 500))
  test('meta nunca abaixo do basal', () =>
    expect(metaConsumo({ ...p, deficitMeta: 2000 }, 0)).toBeCloseTo(1773.75))
  test('kcal treino', () => expect(kcalTreino(8, 80, 60)).toBe(640))
})
