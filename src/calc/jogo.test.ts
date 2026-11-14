import { describe, expect, test } from 'vitest'
import type { DiaJogo } from '../db/repos'
import type { TipoRefeicao } from '../refeicoes'
import { diaN, nivel, registrado, xpDoDia, xpTotal } from './jogo'

function dia(data: string, tipos: TipoRefeicao[], treinos = 0): DiaJogo {
  const kcalPorTipo = Object.fromEntries(tipos.map((t) => [t, 300]))
  return { data, kcalPorTipo, consumido: 300 * tipos.length, treinosKcal: 200 * treinos, qtdTreinos: treinos }
}

describe('xp', () => {
  test('por dia', () => {
    expect(xpDoDia(dia('2026-11-13', ['cafe', 'almoco', 'jantar']))).toBe(25)
    expect(xpDoDia(dia('2026-11-13', ['cafe', 'almoco', 'jantar'], 1))).toBe(40)
    expect(xpDoDia(dia('2026-11-13', [], 2))).toBe(15)
    expect(xpDoDia(dia('2026-11-13', []))).toBe(0)
  })
  test('total é derivado dos dias: apagar um dia reduz o xp', () => {
    const dias = [dia('2026-11-12', ['almoco']), dia('2026-11-13', ['cafe'], 1)]
    expect(xpTotal(dias)).toBe(15 + 30)
    expect(xpTotal(dias.slice(0, 1))).toBe(15)
  })
})

describe('nivel', () => {
  test('curva 50·n·(n−1)', () => {
    expect(nivel(0)).toEqual({ nivel: 1, xpNoNivel: 0, xpDoNivel: 100 })
    expect(nivel(99).nivel).toBe(1)
    expect(nivel(100)).toEqual({ nivel: 2, xpNoNivel: 0, xpDoNivel: 200 })
    expect(nivel(350)).toEqual({ nivel: 3, xpNoNivel: 50, xpDoNivel: 300 })
    expect(nivel(600).nivel).toBe(4)
  })
})

describe('dia N', () => {
  test('sem registros é o dia 1', () => expect(diaN([], '2026-11-14')).toBe(1))
  test('conta desde a primeira refeição', () =>
    expect(diaN([dia('2026-11-10', ['almoco']), dia('2026-11-12', ['cafe'])], '2026-11-14')).toBe(5))
  test('dia só com treino não conta', () => {
    expect(diaN([dia('2026-11-01', [], 1), dia('2026-11-10', ['almoco'])], '2026-11-14')).toBe(5)
    expect(registrado(dia('2026-11-01', [], 1))).toBe(false)
  })
})
