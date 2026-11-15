import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, type Banco } from '../db/banco'
import { exerciciosDoDia, marcarExercicio } from '../db/repos'
import { ProvedorBanco } from '../estado'
import type { Divisao } from '../treino/ficha'
import { FichaTreino, divisaoInicial } from './FichaTreino'

const HOJE = '2026-11-14'
const e = (id: number, nome: string, series: number, reps: string) => ({ id, nome, series, reps, obs: null })
const FICHA: Divisao[] = [
  { id: 1, nome: 'A', titulo: 'Peito e tríceps', exercicios: [e(1, 'Supino reto', 4, '10'), e(2, 'Crucifixo', 3, '12')] },
  { id: 2, nome: 'B', titulo: 'Costas', exercicios: [e(3, 'Remada', 4, '10-12')] },
  { id: 3, nome: 'C', titulo: null, exercicios: [e(4, 'Agachamento', 4, '8')] },
]
let b: Banco
beforeEach(async () => { b = await abrirBanco() })

function abrir(ficha = FICHA) {
  const u = userEvent.setup()
  render(<ProvedorBanco banco={b}><FichaTreino ficha={ficha} data={HOJE} /></ProvedorBanco>)
  return u
}
const divisaoMarcada = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')

test('divisaoInicial: hoje > seguinte à última (circular) > primeira', () => {
  expect(divisaoInicial(FICHA, [], null)).toBe('A')
  expect(divisaoInicial(FICHA, [], 'A')).toBe('B')
  expect(divisaoInicial(FICHA, [], 'C')).toBe('A')
  expect(divisaoInicial(FICHA, [], 'Z')).toBe('A')
  expect(divisaoInicial(FICHA, [{ exercicio: 'Remada', divisao: 'B', cargaKg: null }], 'B')).toBe('B')
})

test('abre na divisão seguinte à última feita e mostra séries', async () => {
  await marcarExercicio(b, { data: '2026-11-12', divisao: 'A', exercicio: 'Supino reto' })
  abrir()
  expect(divisaoMarcada()).toHaveTextContent('B')
  expect(screen.getByText('Remada')).toBeInTheDocument()
  expect(screen.getByText('4 × 10-12')).toBeInTheDocument()
})

test('trocar de divisão mostra os exercícios dela', async () => {
  const u = abrir()
  await u.click(screen.getByRole('radio', { name: /B/ }))
  expect(screen.getByText('Remada')).toBeInTheDocument()
  expect(screen.queryByText('Supino reto')).not.toBeInTheDocument()
})

test('marcar grava e desmarcar apaga', async () => {
  const u = abrir()
  await u.click(screen.getByRole('checkbox', { name: 'Supino reto' }))
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: null }]))
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked()
  await u.click(screen.getByRole('checkbox', { name: 'Supino reto' }))
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([]))
  expect(screen.getByLabelText('Carga de Supino reto (kg)')).toHaveValue('')
})

test('digitar carga com vírgula grava e marca como feito', async () => {
  const u = abrir()
  await u.type(screen.getByLabelText('Carga de Supino reto (kg)'), '32,5')
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: 32.5 }]))
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked()
})

test('carga inválida não grava', async () => {
  const u = abrir()
  await u.type(screen.getByLabelText('Carga de Supino reto (kg)'), '600')
  await u.type(screen.getByLabelText('Carga de Crucifixo (kg)'), 'abc')
  await new Promise((r) => setTimeout(r, 20))
  expect(exerciciosDoDia(b, HOJE).find((e) => e.exercicio === 'Supino reto')?.cargaKg ?? null).not.toBe(600)
  expect(exerciciosDoDia(b, HOJE).find((e) => e.exercicio === 'Crucifixo')).toBeUndefined()
})

test('apagar a carga mantém marcado, sem carga', async () => {
  const u = abrir()
  const campo = screen.getByLabelText('Carga de Supino reto (kg)')
  await u.type(campo, '30')
  await u.clear(campo)
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: null }]))
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked()
})

test('mostra a carga da última vez e a de hoje já registrada', async () => {
  await marcarExercicio(b, { data: '2026-11-07', divisao: 'A', exercicio: 'Supino reto', cargaKg: 30 })
  await marcarExercicio(b, { data: HOJE, divisao: 'A', exercicio: 'Crucifixo', cargaKg: 12.5 })
  abrir()
  expect(screen.getByText('última: 30 kg')).toBeInTheDocument()
  expect(screen.getByLabelText('Carga de Crucifixo (kg)')).toHaveValue('12,5')
  expect(screen.getByRole('checkbox', { name: 'Crucifixo' })).toBeChecked()
  expect(screen.getAllByText(/última:/)).toHaveLength(1)
})

test('carga inválida depois de prefixos válidos não deixa valor escondido no banco', async () => {
  const u = abrir()
  await u.type(screen.getByLabelText('Carga de Supino reto (kg)'), '600')
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: null }]))
  expect(screen.getByText('Carga entre 0 e 500 kg')).toBeInTheDocument()
})

test('apagar a carga antes de terminar de salvar não deixa a carga gravada', async () => {
  b.salvar = () => new Promise((r) => setTimeout(r, 30))
  abrir()
  const campo = screen.getByLabelText('Carga de Supino reto (kg)')
  fireEvent.change(campo, { target: { value: '5' } })
  fireEvent.change(campo, { target: { value: '' } })
  await new Promise((r) => setTimeout(r, 80))
  expect(exerciciosDoDia(b, HOJE).find((e) => e.exercicio === 'Supino reto')?.cargaKg ?? null).toBeNull()
})

test('dois toques rápidos na caixa desmarcam', async () => {
  b.salvar = () => new Promise((r) => setTimeout(r, 30))
  abrir()
  const caixa = screen.getByRole('checkbox', { name: 'Supino reto' })
  fireEvent.click(caixa)
  fireEvent.click(caixa)
  await new Promise((r) => setTimeout(r, 80))
  expect(exerciciosDoDia(b, HOJE)).toEqual([])
})

test('tocar na última carga repete o valor e marca como feito', async () => {
  await marcarExercicio(b, { data: '2026-11-07', divisao: 'A', exercicio: 'Supino reto', cargaKg: 32.5 })
  const u = abrir()
  await u.click(screen.getByRole('radio', { name: /A/ }))
  await u.type(screen.getByLabelText('Carga de Supino reto (kg)'), '20')
  await u.click(screen.getByRole('button', { name: 'Repetir última carga de Supino reto: 32,5 kg' }))
  await waitFor(() => expect(exerciciosDoDia(b, HOJE)).toEqual([{ exercicio: 'Supino reto', divisao: 'A', cargaKg: 32.5 }]))
  expect(screen.getByLabelText('Carga de Supino reto (kg)')).toHaveValue('32,5')
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked()
})
