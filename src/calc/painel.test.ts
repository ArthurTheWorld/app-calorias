import { describe, expect, test } from 'vitest'
import type { DiaJogo } from '../db/repos'
import type { TipoRefeicao } from '../refeicoes'
import type { DiaResumo } from './historico'
import { fechamentoOntem, painel } from './painel'

const res = (data: string, deficit: number, gasto = 2000): DiaResumo =>
  ({ data, consumido: gasto - deficit, gasto, deficit, emDeficit: deficit > 0 })

function dia(data: string, kcal: Partial<Record<TipoRefeicao, number>>): DiaJogo {
  return { data, kcalPorTipo: kcal, consumido: Object.values(kcal).reduce((s, k) => s + k!, 0), treinosKcal: 0, qtdTreinos: 0 }
}

describe('painel', () => {
  test('sem dados', () =>
    expect(painel([], [], '2026-11-14')).toEqual({ sequencia: 0, recorde: 0, media7: null, ontem: null, registros14: 0 }))

  test('hoje não entra na sequência; média dos 7 dias fechados', () => {
    const r = [
      res('2026-11-05', 1000), // fora dos últimos 7 fechados
      ...['07', '08', '09', '10', '11', '12', '13'].map((d) => res(`2026-11-${d}`, 100)),
      res('2026-11-14', 300),
    ]
    const dias = r.map((x) => dia(x.data, { almoco: x.consumido }))
    expect(painel(r, dias, '2026-11-14')).toEqual({ sequencia: 7, recorde: 7, media7: 100, ontem: 100, registros14: 9 })
  })

  test('registros conta 14 dias com hoje; dia só com treino não conta', () => {
    const dias = [
      dia('2026-10-31', { almoco: 500 }), // fora da janela
      dia('2026-11-01', { almoco: 500 }),
      { data: '2026-11-10', kcalPorTipo: {}, consumido: 0, treinosKcal: 300, qtdTreinos: 1 },
      dia('2026-11-14', { almoco: 500 }),
    ]
    expect(painel([], dias, '2026-11-14').registros14).toBe(2)
  })
})

describe('fechamento de ontem', () => {
  const anteriores = [
    dia('2026-11-11', { cafe: 300, almoco: 600, lanche: 250, jantar: 400 }),
    dia('2026-11-12', { cafe: 300, almoco: 600, lanche: 250, jantar: 560 }),
  ]

  test('sem ontem', () => expect(fechamentoOntem(anteriores, [], '2026-11-14')).toBeNull())

  test('cita a refeição mais acima da própria média', () => {
    const ontem = dia('2026-11-13', { cafe: 300, almoco: 600, lanche: 250, jantar: 620 })
    expect(fechamentoOntem([...anteriores, ontem], [res('2026-11-13', 180, 1950)], '2026-11-14'))
      .toBe('Ontem: 1.770 kcal, 180 abaixo do gasto. O jantar foi 620 kcal, acima da sua média de 480.')
  })

  test('nenhuma acima da média: cita a maior', () => {
    const ontem = dia('2026-11-13', { cafe: 300, almoco: 600, jantar: 400 })
    expect(fechamentoOntem([...anteriores, ontem], [res('2026-11-13', 700, 2000)], '2026-11-14'))
      .toBe('Ontem: 1.300 kcal, 700 abaixo do gasto. A maior refeição foi o almoço, com 600 kcal.')
  })

  test('acima do gasto, sem vermelho nem bronca', () => {
    const ontem = dia('2026-11-13', { almoco: 600, jantar: 1520 })
    expect(fechamentoOntem([...anteriores, ontem], [res('2026-11-13', -120, 2000)], '2026-11-14'))
      .toMatch(/^Ontem: 2\.120 kcal, 120 acima do gasto\. O jantar foi 1\.520 kcal/)
  })

  test('primeira madrugada não é comparada', () => {
    const ontem = dia('2026-11-13', { almoco: 500, madrugada: 900 })
    expect(fechamentoOntem([...anteriores, ontem], [res('2026-11-13', 600, 2000)], '2026-11-14'))
      .toBe('Ontem: 1.400 kcal, 600 abaixo do gasto. A maior refeição foi a madrugada, com 900 kcal.')
  })
})
