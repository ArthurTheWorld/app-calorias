import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { abrirBanco, type Banco } from '../db/banco'
import { adicionarDivisao, adicionarExercicio, lerFicha } from '../db/ficha'
import { exerciciosDoDia, marcarExercicio, salvarPerfil } from '../db/repos'
import { ProvedorBanco } from '../estado'
import { Treino } from './Treino'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
let b: Banco
beforeEach(async () => {
  b = await abrirBanco()
  await salvarPerfil(b, perfil)
})
afterEach(() => vi.restoreAllMocks())

function abrir() {
  const u = userEvent.setup()
  render(<ProvedorBanco banco={b}><Treino perfil={perfil} /></ProvedorBanco>)
  return u
}
const ex = (nome: string, series = 4, reps = '10') => ({ nome, series, reps, obs: null })
const nomes = () => lerFicha(b).flatMap((d) => d.exercicios.map((e) => e.nome))
const chipMarcado = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')

async function novoExercicio(u: ReturnType<typeof userEvent.setup>, nome: string, series?: string, reps?: string) {
  await u.click(screen.getByRole('button', { name: '+ Exercício' }))
  await u.type(screen.getByLabelText('Nome'), nome)
  if (series !== undefined) { await u.clear(screen.getByLabelText('Séries')); await u.type(screen.getByLabelText('Séries'), series) }
  if (reps !== undefined) { await u.clear(screen.getByLabelText('Repetições')); await u.type(screen.getByLabelText('Repetições'), reps) }
  await u.click(screen.getByRole('button', { name: 'Salvar exercício' }))
}

test('ficha vazia: cartão Montar ficha, sem divisões, e o registro de kcal continua', () => {
  abrir()
  expect(screen.getByRole('button', { name: 'Montar ficha' })).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Registrar treino' })).toBeInTheDocument()
})

test('Montar ficha cria a divisão A e abre o editor', async () => {
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Montar ficha' }))
  expect(await screen.findByRole('heading', { name: 'Editar ficha' })).toBeInTheDocument()
  expect(chipMarcado()).toHaveTextContent('A')
  expect(screen.getByLabelText('Nome da divisão')).toHaveValue('A')
  expect(lerFicha(b).map((d) => d.nome)).toEqual(['A'])
})

test('adicionar exercício com 4 × 10 de padrão e ver na ficha depois de Pronto', async () => {
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Montar ficha' }))
  await screen.findByRole('heading', { name: 'Editar ficha' })
  await novoExercicio(u, 'Supino reto')
  expect(await screen.findByText('Supino reto · 4 × 10')).toBeInTheDocument()
  await novoExercicio(u, 'Abdominal', '3', 'até a falha')
  expect(await screen.findByText('Abdominal · 3 × até a falha')).toBeInTheDocument()
  expect(nomes()).toEqual(['Supino reto', 'Abdominal'])
  await u.click(screen.getByRole('button', { name: 'Pronto' }))
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Editar ficha' })).toBeInTheDocument()
})

test('séries inválidas não deixam salvar; nome repetido avisa sem gravar', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino reto'))
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  await u.click(screen.getByRole('button', { name: '+ Exercício' }))
  await u.type(screen.getByLabelText('Nome'), 'supino reto')
  await u.clear(screen.getByLabelText('Séries'))
  await u.type(screen.getByLabelText('Séries'), '0')
  expect(screen.getByRole('button', { name: 'Salvar exercício' })).toBeDisabled()
  await u.clear(screen.getByLabelText('Séries'))
  await u.type(screen.getByLabelText('Séries'), '3')
  await u.click(screen.getByRole('button', { name: 'Salvar exercício' }))
  expect(await screen.findByText('Já existe um exercício com esse nome nesta divisão.')).toBeInTheDocument()
  expect(nomes()).toEqual(['Supino reto'])
})

test('editar, mover e remover exercício', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino'))
  await adicionarExercicio(b, a, ex('Crucifixo', 3, '12'))
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  await u.click(screen.getByRole('button', { name: 'Editar Supino' }))
  expect(screen.getByLabelText('Nome')).toHaveValue('Supino')
  expect(screen.getByLabelText('Séries')).toHaveValue('4')
  await u.type(screen.getByLabelText('Nome'), ' reto')
  await u.click(screen.getByRole('button', { name: 'Salvar exercício' }))
  expect(await screen.findByText('Supino reto · 4 × 10')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Descer Supino reto' }))
  await waitFor(() => expect(nomes()).toEqual(['Crucifixo', 'Supino reto']))
  await u.click(screen.getByRole('button', { name: 'Remover Crucifixo' }))
  await waitFor(() => expect(nomes()).toEqual(['Supino reto']))
  expect(screen.queryByText(/Crucifixo ·/)).not.toBeInTheDocument()
})

test('+ Divisão cria a próxima letra; renomear grava; nome repetido avisa', async () => {
  await adicionarDivisao(b)
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  await u.click(screen.getByRole('button', { name: '+ Divisão' }))
  await waitFor(() => expect(chipMarcado()).toHaveTextContent('B'))
  await waitFor(() => expect(screen.getByLabelText('Nome da divisão')).toHaveValue('B'))
  const nome = screen.getByLabelText('Nome da divisão')
  await u.clear(nome)
  await u.type(nome, 'a')
  expect(screen.getByText('Use um nome que ainda não existe.')).toBeInTheDocument()
  await u.clear(nome)
  await u.type(nome, 'Pernas')
  await u.type(screen.getByLabelText('Descrição'), 'Quadríceps')
  await waitFor(() => expect(lerFicha(b)[1]).toMatchObject({ nome: 'Pernas', titulo: 'Quadríceps' }))
  expect(await within(screen.getByRole('radiogroup', { name: 'Divisões' })).findByRole('radio', { name: 'Pernas' })).toBeInTheDocument()
})

test('remover divisão pede confirmação', async () => {
  const a = await adicionarDivisao(b)
  await adicionarExercicio(b, a, ex('Supino'))
  await adicionarDivisao(b)
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  await u.click(screen.getByRole('button', { name: 'Remover divisão A' }))
  expect(lerFicha(b)).toHaveLength(2)
  await u.click(screen.getByRole('button', { name: 'Remover divisão A' }))
  await waitFor(() => expect(lerFicha(b).map((d) => d.nome)).toEqual(['B']))
  expect(confirmar).toHaveBeenCalledTimes(2)
  expect(chipMarcado()).toHaveTextContent('B')
})

test('remover a última divisão e sair volta para Montar ficha', async () => {
  await adicionarDivisao(b)
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await u.click(screen.getByRole('button', { name: 'Remover divisão A' }))
  await waitFor(() => expect(lerFicha(b)).toEqual([]))
  await u.click(screen.getByRole('button', { name: 'Pronto' }))
  expect(screen.getByRole('button', { name: 'Montar ficha' })).toBeInTheDocument()
})

test('renomear divisão grava só o nome final, sem misturar com histórico de nomes intermediários', async () => {
  await adicionarDivisao(b)
  await marcarExercicio(b, { data: '2026-11-08', divisao: 'C', exercicio: 'Agachamento' })
  await marcarExercicio(b, { data: '2026-11-10', divisao: 'A', exercicio: 'Supino' })
  const u = abrir()
  await u.click(screen.getByRole('button', { name: 'Editar ficha' }))
  const nome = screen.getByLabelText('Nome da divisão')
  await u.clear(nome)
  await u.type(nome, 'Costas')
  expect(lerFicha(b)[0].nome).toBe('A')
  await u.click(screen.getByRole('button', { name: 'Pronto' }))
  await waitFor(() => expect(lerFicha(b)[0].nome).toBe('Costas'))
  expect(exerciciosDoDia(b, '2026-11-08')[0].divisao).toBe('C')
  expect(exerciciosDoDia(b, '2026-11-10')[0].divisao).toBe('Costas')
})
