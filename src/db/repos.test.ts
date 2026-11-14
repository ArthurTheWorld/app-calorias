import { beforeEach, describe, expect, test } from 'vitest'
import { abrirBanco, type Banco } from './banco'
import {
  addRefeicao, addTreino, adicionarApelido, apelidosDoUsuario, buscarAlimentos, criarAlimento, diasDoJogo, getPerfil, removerApelido,
  refeicoesDoDia, removerRefeicao, salvarPerfil, totaisPorDia, treinosDoDia,
} from './repos'

let b: Banco
beforeEach(async () => { b = await abrirBanco() })

const arroz = { nome: 'Arroz, branco, cozido', kcal100g: 128, proteinaG: 2.5, carboG: 28.1, gorduraG: 0.2, origem: 'TACO' as const }

describe('repos', () => {
  test('perfil vazio retorna null', () => expect(getPerfil(b)).toBeNull())

  test('salva e lê perfil', async () => {
    const p = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 500 }
    await salvarPerfil(b, p)
    expect(getPerfil(b)).toEqual(p)
    await salvarPerfil(b, { ...p, pesoKg: 79 })
    expect(getPerfil(b)?.pesoKg).toBe(79)
  })

  test('refeicao calcula kcal', async () => {
    const id = await criarAlimento(b, arroz)
    await addRefeicao(b, { data: '2026-11-14', tipo: 'almoco', alimentoId: id, gramas: 150 })
    const rs = refeicoesDoDia(b, '2026-11-14')
    expect(rs).toHaveLength(1)
    expect(rs[0].kcal).toBeCloseTo(192)
    expect(rs[0].nome).toBe('Arroz, branco, cozido')
    await removerRefeicao(b, rs[0].id)
    expect(refeicoesDoDia(b, '2026-11-14')).toHaveLength(0)
  })

  test('busca ignora acento e caixa', async () => {
    await criarAlimento(b, { ...arroz, nome: 'Feijão, carioca, cozido', kcal100g: 76 })
    expect(buscarAlimentos(b, 'FEIJAO')[0]?.nome).toBe('Feijão, carioca, cozido')
    expect(buscarAlimentos(b, 'carioca feij')).toHaveLength(1)
  })

  test('totaisPorDia soma refeições e treinos', async () => {
    const id = await criarAlimento(b, arroz)
    await addRefeicao(b, { data: '2026-11-13', tipo: 'almoco', alimentoId: id, gramas: 100 })
    await addRefeicao(b, { data: '2026-11-13', tipo: 'jantar', alimentoId: id, gramas: 100 })
    await addTreino(b, { data: '2026-11-13', tipo: 'Musculação', duracaoMin: 60, kcal: 400 })
    await addTreino(b, { data: '2026-11-14', tipo: 'Corrida', duracaoMin: 30, kcal: 300 })
    expect(treinosDoDia(b, '2026-11-14')).toHaveLength(1)
    expect(totaisPorDia(b, '2026-11-01', '2026-11-30')).toEqual([
      { data: '2026-11-13', consumido: 256, treinos: 400 },
      { data: '2026-11-14', consumido: 0, treinos: 300 },
    ])
  })

  test('exportar e reabrir preserva dados', async () => {
    await criarAlimento(b, arroz)
    const b2 = await abrirBanco(b.exportar())
    expect(buscarAlimentos(b2, 'arroz')).toHaveLength(1)
  })
})

test('diasDoJogo agrupa refeições por tipo e treinos por dia', async () => {
  const id = await criarAlimento(b, arroz)
  await addRefeicao(b, { data: '2026-11-13', tipo: 'almoco', alimentoId: id, gramas: 100 })
  await addRefeicao(b, { data: '2026-11-13', tipo: 'almoco', alimentoId: id, gramas: 100 })
  await addRefeicao(b, { data: '2026-11-13', tipo: 'jantar', alimentoId: id, gramas: 100 })
  await addTreino(b, { data: '2026-11-14', tipo: 'Corrida', duracaoMin: 30, kcal: 300 })
  const dias = diasDoJogo(b)
  expect(dias).toHaveLength(2)
  expect(dias[0]).toMatchObject({ data: '2026-11-13', treinosKcal: 0, qtdTreinos: 0 })
  expect(dias[0].consumido).toBeCloseTo(384)
  expect(dias[0].kcalPorTipo.almoco).toBeCloseTo(256)
  expect(dias[0].kcalPorTipo.jantar).toBeCloseTo(128)
  expect(Object.keys(dias[0].kcalPorTipo)).toHaveLength(2)
  expect(dias[1]).toEqual({ data: '2026-11-14', kcalPorTipo: {}, consumido: 0, treinosKcal: 300, qtdTreinos: 1 })
})

test('apelidos do usuário: sem duplicar, com nome do alimento, removíveis', async () => {
  const id = await criarAlimento(b, arroz)
  await adicionarApelido(b, id, 'Marmita da Vó')
  await adicionarApelido(b, id, '  marmita   da vo ')
  const lista = apelidosDoUsuario(b)
  expect(lista).toHaveLength(1)
  expect(lista[0]).toMatchObject({ alimentoId: id, termo: 'Marmita da Vó', nomeAlimento: 'Arroz, branco, cozido' })
  await removerApelido(b, lista[0].id)
  expect(apelidosDoUsuario(b)).toHaveLength(0)
})
