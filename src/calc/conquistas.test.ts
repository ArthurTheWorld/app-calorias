import { describe, expect, test } from 'vitest'
import type { DiaJogo } from '../db/repos'
import type { TipoRefeicao } from '../refeicoes'
import { conquistas, proximaConquista, textoFalta } from './conquistas'
import type { DiaResumo } from './historico'

function dia(data: string, tipos: TipoRefeicao[], treinos = 0): DiaJogo {
  return {
    data, kcalPorTipo: Object.fromEntries(tipos.map((t) => [t, 400])),
    consumido: 400 * tipos.length, treinosKcal: 300 * treinos, qtdTreinos: treinos,
  }
}
const res = (data: string, emDeficit = true): DiaResumo =>
  ({ data, consumido: 1500, gasto: emDeficit ? 2000 : 1000, deficit: emDeficit ? 500 : -500, emDeficit })
const pega = (cs: ReturnType<typeof conquistas>, id: string) => cs.find((c) => c.id === id)!

describe('conquistas', () => {
  test('sem dados: as 9, nenhuma desbloqueada', () => {
    const cs = conquistas([], [], '2026-11-14')
    expect(cs.map((c) => c.id)).toEqual([
      'primeiro-registro', 'dias-7', 'dias-30', 'semana-completa', 'deficit-3', 'deficit-7',
      'primeiro-treino', 'treinos-10', 'dia-completo',
    ])
    expect(cs.some((c) => c.desbloqueada)).toBe(false)
    expect(cs.every((c) => c.progresso === 0)).toBe(true)
  })

  test('hoje não conta para as de déficit', () => {
    const r = [res('2026-11-12'), res('2026-11-13'), res('2026-11-14')]
    expect(pega(conquistas([], r, '2026-11-14'), 'deficit-3')).toMatchObject({ desbloqueada: false, progresso: 2 })
    expect(pega(conquistas([], r, '2026-11-15'), 'deficit-3')).toMatchObject({ desbloqueada: true, progresso: 3 })
  })

  test('dia completo exige café, almoço, lanche e jantar', () => {
    expect(pega(conquistas([dia('2026-11-13', ['cafe', 'almoco', 'lanche', 'jantar'])], [], '2026-11-14'), 'dia-completo').desbloqueada).toBe(true)
    expect(pega(conquistas([dia('2026-11-13', ['madrugada', 'almoco'])], [], '2026-11-14'), 'dia-completo').progresso).toBe(1)
  })

  test('dias só com treino não contam como registrados', () => {
    const dias = Array.from({ length: 8 }, (_, i) => dia(`2026-11-0${i + 1}`, [], 1))
    const cs = conquistas(dias, [], '2026-11-14')
    expect(pega(cs, 'dias-7').progresso).toBe(0)
    expect(pega(cs, 'primeiro-treino').desbloqueada).toBe(true)
    expect(pega(cs, 'treinos-10').progresso).toBe(8)
  })

  test('semana completa usa a maior sequência de dias registrados', () => {
    const dias = ['01', '02', '03', '05', '06'].map((d) => dia(`2026-11-${d}`, ['almoco']))
    expect(pega(conquistas(dias, [], '2026-11-14'), 'semana-completa').progresso).toBe(3)
  })

  test('próxima é a bloqueada de maior fração; textoFalta diz o que falta', () => {
    const dias = ['01', '02', '03', '04', '05', '06'].map((d) => dia(`2026-11-${d}`, ['almoco']))
    const p = proximaConquista(conquistas(dias, [], '2026-11-14'))
    expect(p?.id).toBe('dias-7')
    expect(textoFalta(p!)).toMatch(/falta/)
    expect(textoFalta(p!)).toMatch(/1/)
  })
})
