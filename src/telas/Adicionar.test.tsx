import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, type Banco } from '../db/banco'
import { sincronizarPorcoesLista } from '../db/porcoes'
import {
  addRefeicao, adicionarPorcao, criarAlimento, inserirAlimentoSemSalvar, porcoesDoAlimento, refeicoesDoDia,
  removerPorcao,
} from '../db/repos'
import { ProvedorBanco } from '../estado'
import { Adicionar } from './Adicionar'

const HOJE = '2026-11-14'
let b: Banco
let ovo: number

const taco = (nome: string, kcal100g: number) =>
  inserirAlimentoSemSalvar(b, { nome, kcal100g, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'TACO' })

beforeEach(async () => {
  b = await abrirBanco()
  taco('Café, infusão 10%', 9)
  ovo = taco('Ovo, de galinha, inteiro, cozido/10minutos', 146)
  taco('Pão, trigo, forma, integral', 253)
  sincronizarPorcoesLista(b)
})

async function abrir(busca: string, nome: string) {
  const u = userEvent.setup()
  render(<ProvedorBanco banco={b}><Adicionar data={HOJE} tipo="cafe" fechar={() => {}} /></ProvedorBanco>)
  await u.type(screen.getByPlaceholderText('Buscar alimento'), busca)
  await u.click(await screen.findByText(nome))
  return u
}

const marcado = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')
const total = () => screen.getByTestId('total')
const OVO = 'Ovo, de galinha, inteiro, cozido/10minutos'

test('abre na primeira porção da lista', async () => {
  await abrir('café', 'Café, infusão 10%')
  expect(marcado().map((r) => r.textContent)).toEqual(['Xícara (180 ml)'])
  expect(total()).toHaveTextContent('180 g · 16 kcal')
})

test('+ leva 1 → 2 e − não desce de 1', async () => {
  const u = await abrir('ovo', OVO)
  await u.click(screen.getByRole('button', { name: 'Mais' }))
  expect(screen.getByLabelText('Quantidade')).toHaveValue('2')
  expect(total()).toHaveTextContent('100 g · 146 kcal')
  await u.click(screen.getByRole('button', { name: 'Menos' }))
  await u.click(screen.getByRole('button', { name: 'Menos' }))
  expect(screen.getByLabelText('Quantidade')).toHaveValue('1')
})

test('registra 2 × Fatia', async () => {
  const u = await abrir('forma', 'Pão, trigo, forma, integral')
  await u.click(screen.getByRole('button', { name: 'Mais' }))
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  await waitFor(() => expect(refeicoesDoDia(b, HOJE)).toHaveLength(1))
  const [r] = refeicoesDoDia(b, HOJE)
  expect([r.gramas, r.qtd, r.porcao]).toEqual([50, 2, 'Fatia'])
})

test('lembra a última porção e quantidade', async () => {
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: ovo, gramas: 100, qtd: 2, porcao: 'Unidade' })
  await abrir('ovo', OVO)
  expect(marcado().map((r) => r.textContent)).toEqual(['Unidade'])
  expect(screen.getByLabelText('Quantidade')).toHaveValue('2')
})

test('último registro em gramas abre em Gramas com aquele valor', async () => {
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: ovo, gramas: 80 })
  await abrir('ovo', OVO)
  expect(marcado().map((r) => r.textContent)).toEqual(['Gramas'])
  expect(screen.getByLabelText('Gramas')).toHaveValue('80')
  expect(screen.queryByRole('button', { name: 'Mais' })).toBeNull()
})

test('porção apagada volta ao padrão', async () => {
  const id = await adicionarPorcao(b, ovo, 'Ovo grande', 60)
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: ovo, gramas: 180, qtd: 3, porcao: 'Ovo grande' })
  await removerPorcao(b, id)
  await abrir('ovo', OVO)
  expect(marcado().map((r) => r.textContent)).toEqual(['Unidade'])
  expect(screen.getByLabelText('Quantidade')).toHaveValue('1')
})

test('porção do usuário com nome igual vence na lembrança', async () => {
  await adicionarPorcao(b, ovo, 'Unidade', 60)
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: ovo, gramas: 60, qtd: 1, porcao: 'Unidade' })
  await abrir('ovo', OVO)
  const unidades = screen.getAllByRole('radio', { name: 'Unidade' })
  expect(unidades.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true'])
  expect(total()).toHaveTextContent('60 g')
})

test('digitar 1,5 depois de + recalcula', async () => {
  const u = await abrir('ovo', OVO)
  await u.click(screen.getByRole('button', { name: 'Mais' }))
  const q = screen.getByLabelText('Quantidade')
  await u.clear(q)
  await u.type(q, '1,5')
  expect(total()).toHaveTextContent('75 g')
  await u.click(screen.getByRole('button', { name: 'Mais' }))
  expect(q).toHaveValue('2')
})

test('quantidade 0 ou vazia bloqueia Adicionar', async () => {
  const u = await abrir('ovo', OVO)
  const q = screen.getByLabelText('Quantidade')
  await u.clear(q)
  expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
  await u.type(q, '0')
  expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
})

test('alimento sem porções abre em Gramas 100 e cria Minha porção', async () => {
  const id = await criarAlimento(b, { nome: 'Caneca de café', kcal100g: 10, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  const u = await abrir('caneca', 'Caneca de café')
  expect(screen.getByLabelText('Gramas')).toHaveValue('100')
  await u.click(screen.getByRole('button', { name: '+ Minha porção' }))
  await u.type(screen.getByLabelText('Nome da porção'), 'Minha caneca')
  await u.type(screen.getByLabelText('Gramas ou ml'), '250')
  await u.click(screen.getByRole('button', { name: 'Salvar porção' }))
  await waitFor(() => expect(marcado().map((r) => r.textContent)).toEqual(['Minha caneca']))
  expect(total()).toHaveTextContent('250 g · 25 kcal')
  expect(porcoesDoAlimento(b, id).map((p) => [p.nome, p.origem])).toEqual([['Minha caneca', 'usuario']])
})

test('último registro de 1000 g reabre como 1000, não 1', async () => {
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: ovo, gramas: 1000 })
  await abrir('ovo', OVO)
  expect(screen.getByLabelText('Gramas')).toHaveValue('1000')
})
