import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, type Banco } from './banco'
import {
  adicionarDivisao, adicionarExercicio, editarDivisao, editarExercicio, lerFicha, moverExercicio, removerDivisao,
  removerExercicio,
} from './ficha'
import { exerciciosDoDia, marcarExercicio, ultimaCarga } from './repos'

let b: Banco
beforeEach(async () => { b = await abrirBanco() })
const ex = (nome: string, series = 4, reps = '10', obs: string | null = null) => ({ nome, series, reps, obs })

test('ficha começa vazia; divisões ganham a próxima letra livre', async () => {
  expect(lerFicha(b)).toEqual([])
  await adicionarDivisao(b)
  const idB = await adicionarDivisao(b)
  await adicionarDivisao(b)
  expect(lerFicha(b).map((d) => d.nome)).toEqual(['A', 'B', 'C'])
  await removerDivisao(b, idB)
  await adicionarDivisao(b)
  expect(lerFicha(b).map((d) => d.nome)).toEqual(['A', 'C', 'B'])
})

test('exercícios em ordem, com séries, reps e obs', async () => {
  const a = await adicionarDivisao(b)
  expect(await adicionarExercicio(b, a, ex('Supino reto'))).toBe(true)
  expect(await adicionarExercicio(b, a, ex('Abdominal', 3, 'até a falha', 'sem carga'))).toBe(true)
  const [d] = lerFicha(b)
  expect(d.exercicios.map(({ nome, series, reps, obs }) => ({ nome, series, reps, obs })))
    .toEqual([ex('Supino reto'), ex('Abdominal', 3, 'até a falha', 'sem carga')])
})

test('recusa exercício inválido ou repetido na mesma divisão', async () => {
  const a = await adicionarDivisao(b)
  const c = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino reto'))
  expect(await adicionarExercicio(b, a, ex('  supino reto '))).toBe(false)
  expect(await adicionarExercicio(b, a, ex(' '))).toBe(false)
  expect(await adicionarExercicio(b, a, ex('Remada', 0))).toBe(false)
  expect(await adicionarExercicio(b, a, ex('Remada', 21))).toBe(false)
  expect(await adicionarExercicio(b, a, ex('Remada', 2.5))).toBe(false)
  expect(await adicionarExercicio(b, a, ex('Remada', 3, ' '))).toBe(false)
  expect(await adicionarExercicio(b, c, ex('Supino reto'))).toBe(true)
  expect(lerFicha(b)[0].exercicios).toHaveLength(1)
})

test('nome e reps são gravados sem espaços nas pontas; obs vazia vira null', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('  Remada  ', 3, ' 12 ', '  '))
  expect(lerFicha(b)[0].exercicios[0]).toMatchObject(ex('Remada', 3, '12', null))
})

test('mover troca a ordem e para nas pontas', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('X'))
  await adicionarExercicio(b, a, ex('Y'))
  await adicionarExercicio(b, a, ex('Z'))
  const id = (n: string) => lerFicha(b)[0].exercicios.find((e) => e.nome === n)!.id
  await moverExercicio(b, id('Z'), -1)
  expect(lerFicha(b)[0].exercicios.map((e) => e.nome)).toEqual(['X', 'Z', 'Y'])
  await moverExercicio(b, id('X'), -1)
  await moverExercicio(b, id('Y'), 1)
  expect(lerFicha(b)[0].exercicios.map((e) => e.nome)).toEqual(['X', 'Z', 'Y'])
})

test('corrigir o nome leva o histórico junto, sem quebrar com registro do mesmo dia', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino'))
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino', cargaKg: 30 })
  await marcarExercicio(b, { data: '2026-11-12', divisao: 'A', exercicio: 'Supino', cargaKg: 32 })
  await marcarExercicio(b, { data: '2026-11-12', divisao: 'A', exercicio: 'Supino reto', cargaKg: 40 })
  const id = lerFicha(b)[0].exercicios[0].id
  expect(await editarExercicio(b, id, ex('Supino reto', 3, '12'))).toBe(true)
  expect(lerFicha(b)[0].exercicios[0]).toMatchObject(ex('Supino reto', 3, '12'))
  expect(ultimaCarga(b, 'Supino reto', '2026-11-11')).toBe(30)
  expect(exerciciosDoDia(b, '2026-11-12').map((e) => e.exercicio).sort()).toEqual(['Supino', 'Supino reto'])
})

test('editar recusa nome repetido na divisão e dados inválidos', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('X'))
  await adicionarExercicio(b, a, ex('Y'))
  const y = lerFicha(b)[0].exercicios[1].id
  expect(await editarExercicio(b, y, ex('x'))).toBe(false)
  expect(await editarExercicio(b, y, ex('Y', 0))).toBe(false)
  expect(await editarExercicio(b, y, ex('Y', 5))).toBe(true)
  expect(lerFicha(b)[0].exercicios[1].series).toBe(5)
})

test('renomear divisão: único, não vazio, e atualiza o histórico', async () => {
  const a = await adicionarDivisao(b)
  await adicionarDivisao(b)
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino' })
  expect(await editarDivisao(b, a, { nome: 'b', titulo: null })).toBe(false)
  expect(await editarDivisao(b, a, { nome: ' ', titulo: null })).toBe(false)
  expect(await editarDivisao(b, a, { nome: 'Superiores', titulo: 'Peito e costas' })).toBe(true)
  expect(lerFicha(b)[0]).toMatchObject({ nome: 'Superiores', titulo: 'Peito e costas' })
  expect(exerciciosDoDia(b, '2026-11-10')[0].divisao).toBe('Superiores')
  expect(await editarDivisao(b, a, { nome: 'Superiores', titulo: '  ' })).toBe(true)
  expect(lerFicha(b)[0].titulo).toBeNull()
})

test('remover divisão leva os exercícios dela, mas não o histórico', async () => {
  b.db.run('PRAGMA foreign_keys = OFF')
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino'))
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino', cargaKg: 30 })
  await removerDivisao(b, a)
  expect(lerFicha(b)).toEqual([])
  expect(b.db.exec('SELECT COUNT(*) FROM exercicios_ficha')[0].values[0][0]).toBe(0)
  expect(ultimaCarga(b, 'Supino', '2026-11-14')).toBe(30)
})

test('remover exercício', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('X'))
  await removerExercicio(b, lerFicha(b)[0].exercicios[0].id)
  expect(lerFicha(b)[0].exercicios).toEqual([])
})
