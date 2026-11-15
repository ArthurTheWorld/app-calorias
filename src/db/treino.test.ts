import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, type Banco } from './banco'
import { desmarcarExercicio, exerciciosDoDia, marcarExercicio, ultimaCarga, ultimaDivisao } from './repos'

let b: Banco
beforeEach(async () => { b = await abrirBanco() })

test('marcar sem carga e depois desmarcar', async () => {
  await marcarExercicio(b, { data: '2026-11-14', divisao: 'A', exercicio: 'Supino reto' })
  expect(exerciciosDoDia(b, '2026-11-14')).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: null }])
  await desmarcarExercicio(b, '2026-11-14', 'Supino reto')
  expect(exerciciosDoDia(b, '2026-11-14')).toEqual([])
})

test('marcar de novo sem carga preserva a carga; carga null limpa', async () => {
  await marcarExercicio(b, { data: '2026-11-14', divisao: 'A', exercicio: 'Supino reto', cargaKg: 32.5 })
  await marcarExercicio(b, { data: '2026-11-14', divisao: 'A', exercicio: 'Supino reto' })
  expect(exerciciosDoDia(b, '2026-11-14')[0].cargaKg).toBe(32.5)
  await marcarExercicio(b, { data: '2026-11-14', divisao: 'A', exercicio: 'Supino reto', cargaKg: null })
  expect(exerciciosDoDia(b, '2026-11-14')).toHaveLength(1)
  expect(exerciciosDoDia(b, '2026-11-14')[0].cargaKg).toBeNull()
})

test('ultimaCarga pega a mais recente antes do dia, ignorando o dia e cargas vazias', async () => {
  await marcarExercicio(b, { data: '2026-11-01', divisao: 'A', exercicio: 'Supino reto', cargaKg: 28 })
  await marcarExercicio(b, { data: '2026-11-08', divisao: 'B', exercicio: 'Supino reto', cargaKg: 30 })
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino reto' })
  await marcarExercicio(b, { data: '2026-11-14', divisao: 'A', exercicio: 'Supino reto', cargaKg: 32 })
  expect(ultimaCarga(b, 'Supino reto', '2026-11-14')).toBe(30)
  expect(ultimaCarga(b, 'Crucifixo', '2026-11-14')).toBeNull()
})

test('ultimaDivisao é a do registro mais recente', async () => {
  expect(ultimaDivisao(b)).toBeNull()
  await marcarExercicio(b, { data: '2026-11-12', divisao: 'B', exercicio: 'Remada' })
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino reto' })
  expect(ultimaDivisao(b)).toBe('B')
})
