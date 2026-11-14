import { describe, expect, test } from 'vitest'
import { gastoDia, type Perfil } from './energia'
import { resumirDias, resumoMes, streak, type DiaResumo } from './historico'

const p: Perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 500 }
const G = gastoDia(p, 0) // 2128.5

const dia = (data: string, emDeficit = true): DiaResumo => ({
  data, consumido: emDeficit ? 1800 : 2500, gasto: G, deficit: G - (emDeficit ? 1800 : 2500), emDeficit,
})

describe('historico', () => {
  test('resumirDias ignora dias sem refeição e soma treino ao gasto', () => {
    const r = resumirDias(p, [
      { data: '2026-11-01', consumido: 0, treinos: 300 },
      { data: '2026-11-02', consumido: 2200, treinos: 300 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].gasto).toBeCloseTo(G + 300)
    expect(r[0].deficit).toBeCloseTo(G + 300 - 2200)
    expect(r[0].emDeficit).toBe(true)
  })

  test('streak atravessa mês', () =>
    expect(streak([dia('2026-10-30'), dia('2026-10-31'), dia('2026-11-01')], '2026-11-01'))
      .toEqual({ atual: 3, recorde: 3 }))

  test('dia sem registro quebra', () =>
    expect(streak([dia('2026-11-10'), dia('2026-11-11'), dia('2026-11-13')], '2026-11-13'))
      .toEqual({ atual: 1, recorde: 2 }))

  test('hoje sem registro não zera', () =>
    expect(streak([dia('2026-11-12'), dia('2026-11-13')], '2026-11-14')).toEqual({ atual: 2, recorde: 2 }))

  test('dia acima do gasto quebra', () =>
    expect(streak([dia('2026-11-12'), dia('2026-11-13', false), dia('2026-11-14')], '2026-11-14'))
      .toEqual({ atual: 1, recorde: 1 }))

  test('sem registro há 2 dias zera atual', () =>
    expect(streak([dia('2026-11-10')], '2026-11-14')).toEqual({ atual: 0, recorde: 1 }))

  test('resumoMes', () => {
    const r = resumoMes([dia('2026-10-31'), dia('2026-11-01'), dia('2026-11-02', false)], '2026-11')
    expect(r.diasRegistrados).toBe(2)
    expect(r.diasEmDeficit).toBe(1)
    expect(r.deficitTotal).toBeCloseTo(2 * G - 1800 - 2500)
    expect(r.mediaConsumo).toBeCloseTo(2150)
  })
})
