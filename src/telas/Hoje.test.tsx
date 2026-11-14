import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { abrirBanco, type Banco } from '../db/banco'
import { addRefeicao, buscarAlimentos, criarAlimento, refeicoesDoDia, registrarPeso, salvarPerfil } from '../db/repos'
import { gastoDia, metaConsumo } from '../calc/energia'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
const HOJE = '2026-11-14' // sábado
const ONTEM = '2026-11-13'
let b: Banco
let arroz: number

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 15, 0))
  b = await abrirBanco()
  arroz = await criarAlimento(b, { nome: 'Arroz', kcal100g: 128, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
})
afterEach(() => { vi.useRealTimers() })

test('sem perfil abre o Perfil', async () => {
  render(<App banco={b} />)
  expect(await screen.findByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument()
})

test('Hoje mostra consumido, restante e gasto', async () => {
  await salvarPerfil(b, perfil)
  await addRefeicao(b, { data: HOJE, tipo: 'almoco', alimentoId: arroz, gramas: 150 })
  render(<App banco={b} />)
  expect(await screen.findByTestId('consumido')).toHaveTextContent('192')
  expect(screen.getByTestId('restante')).toHaveTextContent(String(Math.round(metaConsumo(perfil, 0) - 192)))
  expect(screen.getByTestId('gasto')).toHaveTextContent(String(Math.round(gastoDia(perfil, 0))))
})

test('refeições na ordem do dia, com Madrugada', async () => {
  await salvarPerfil(b, perfil)
  render(<App banco={b} />)
  const botoes = await screen.findAllByRole('button', { name: /^Adicionar em / })
  expect(botoes.map((x) => x.getAttribute('aria-label'))).toEqual([
    'Adicionar em Café da manhã', 'Adicionar em Almoço', 'Adicionar em Lanche da tarde',
    'Adicionar em Jantar', 'Adicionar em Madrugada',
  ])
})

test('adicionar alimento pela busca', async () => {
  await salvarPerfil(b, perfil)
  await criarAlimento(b, { nome: 'Banana, prata, crua', kcal100g: 98, proteinaG: 1.3, carboG: 26, gorduraG: 0.1, origem: 'TACO' })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Adicionar em Café da manhã' }))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'banana')
  await u.click(await screen.findByText('Banana, prata, crua'))
  const gramas = screen.getByLabelText('Gramas')
  await u.clear(gramas)
  await u.type(gramas, '0')
  expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
  await u.clear(gramas)
  await u.type(gramas, '200')
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(await screen.findByTestId('consumido')).toHaveTextContent('196')
})

test('Madrugada registrada de manhã vai pro dia anterior, com aviso', async () => {
  vi.setSystemTime(new Date(2026, 10, 14, 9, 0))
  await salvarPerfil(b, perfil)
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Adicionar em Madrugada' }))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'arroz')
  await u.click(await screen.findByText('Arroz'))
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(await screen.findByText('Salvo na madrugada de sexta')).toBeInTheDocument()
  expect(screen.getByTestId('consumido')).toHaveTextContent('0')
  expect(refeicoesDoDia(b, ONTEM)).toHaveLength(1)
})

test('painel de status com xp, nível e fechamento de ontem', async () => {
  await salvarPerfil(b, perfil)
  await addRefeicao(b, { data: ONTEM, tipo: 'cafe', alimentoId: arroz, gramas: 100 })
  await addRefeicao(b, { data: ONTEM, tipo: 'almoco', alimentoId: arroz, gramas: 100 })
  render(<App banco={b} />)
  expect(await screen.findByText('LV 1 · 20 XP')).toBeInTheDocument()
  expect(screen.getByTestId('sequencia')).toHaveTextContent('1')
  expect(screen.getByTestId('recorde')).toHaveTextContent('1')
  expect(screen.getByTestId('registros')).toHaveTextContent('1/14')
  expect(screen.getByTestId('ontem')).not.toHaveTextContent('—')
  expect(screen.getByTestId('fechamento')).toHaveTextContent(/^Ontem:/)
  expect(screen.getByText('DIA 2')).toBeInTheDocument()
})

test('sem histórico: traços, sem fechamento, nada desbloqueado', async () => {
  await salvarPerfil(b, perfil)
  render(<App banco={b} />)
  expect(await screen.findByTestId('media7')).toHaveTextContent('—')
  expect(screen.getByTestId('ontem')).toHaveTextContent('—')
  expect(screen.queryByTestId('fechamento')).toBeNull()
  expect(screen.getByText('DIA 1')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/NaN/)
})

test('acima da meta: âmbar, sem vermelho', async () => {
  await salvarPerfil(b, perfil)
  await addRefeicao(b, { data: HOJE, tipo: 'jantar', alimentoId: arroz, gramas: 3000 })
  const { container } = render(<App banco={b} />)
  expect(await screen.findByTestId('restante')).toHaveClass('acima')
  expect(container.querySelector('[class*="ruim"], [class*="vermelho"]')).toBeNull()
})

test('dia anterior mostra energia e refeições, sem painel', async () => {
  await salvarPerfil(b, perfil)
  await addRefeicao(b, { data: ONTEM, tipo: 'almoco', alimentoId: arroz, gramas: 100 })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Dia anterior' }))
  expect(screen.getByTestId('consumido')).toHaveTextContent('128')
  expect(screen.queryByTestId('sequencia')).toBeNull()
  expect(screen.queryByTestId('fechamento')).toBeNull()
})

test('app aberto de um dia pro outro: depois das 5h a tela vai pro novo dia', async () => {
  vi.setSystemTime(new Date(2026, 10, 13, 23, 0)) // sexta, 23h
  await salvarPerfil(b, perfil)
  const u = userEvent.setup()
  render(<App banco={b} />)
  expect(await screen.findByText('DIA 1')).toBeInTheDocument()
  vi.setSystemTime(new Date(2026, 10, 14, 8, 0)) // sábado, 8h
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(screen.getByTestId('sequencia')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Adicionar em Café da manhã' }))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'arroz')
  await u.click(await screen.findByText('Arroz'))
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(refeicoesDoDia(b, HOJE)).toHaveLength(1)
  expect(refeicoesDoDia(b, ONTEM)).toHaveLength(0)
})

test('ensinar um apelido quando a busca não encontra nada', async () => {
  await salvarPerfil(b, perfil)
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Adicionar em Almoço' }))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'marmita da vó')
  expect(await screen.findByText('Nada encontrado.')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Ensinar "marmita da vó"' }))
  expect(screen.getByText('Procure o alimento que "marmita da vó" quer dizer')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Buscar alimento')).toHaveValue('')
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'arroz')
  await u.click(await screen.findByText('Arroz'))
  expect(screen.getByLabelText('Gramas')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(buscarAlimentos(b, 'marmita da vo')[0]?.nome).toBe('Arroz')
})

test('ensinar: o campo fica focado, e uma escolha errada desfeita com Trocar não vira apelido', async () => {
  await salvarPerfil(b, perfil)
  await criarAlimento(b, { nome: 'Feijão', kcal100g: 76, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Adicionar em Almoço' }))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'marmita')
  await u.click(await screen.findByRole('button', { name: 'Ensinar "marmita"' }))
  expect(screen.getByPlaceholderText('Buscar alimento')).toHaveFocus()
  await u.keyboard('feij')
  await u.click(await screen.findByText('Feijão'))
  await u.click(screen.getByRole('button', { name: 'Trocar' }))
  expect(screen.getByText('Procure o alimento que "marmita" quer dizer')).toBeInTheDocument()
  await u.clear(screen.getByPlaceholderText('Buscar alimento'))
  await u.type(screen.getByPlaceholderText('Buscar alimento'), 'arroz')
  await u.click(await screen.findByText('Arroz'))
  await u.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(buscarAlimentos(b, 'marmita').map((a) => a.nome)).toEqual(['Arroz'])
})

test('dia antigo usa o peso daquele dia', async () => {
  await salvarPerfil(b, perfil)
  await registrarPeso(b, '2026-11-01', 90)
  await registrarPeso(b, HOJE, 80)
  const u = userEvent.setup()
  render(<App banco={b} />)
  expect(await screen.findByTestId('gasto')).toHaveTextContent(String(Math.round(gastoDia({ ...perfil, pesoKg: 80 }, 0))))
  await u.click(screen.getByRole('button', { name: 'Dia anterior' }))
  expect(screen.getByTestId('gasto')).toHaveTextContent(String(Math.round(gastoDia({ ...perfil, pesoKg: 90 }, 0))))
})

test('item registrado por porção mostra quantidade × porção', async () => {
  await salvarPerfil(b, perfil)
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: arroz, gramas: 50, qtd: 2, porcao: 'Fatia' })
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: arroz, gramas: 75, qtd: 1.5, porcao: 'Unidade' })
  await addRefeicao(b, { data: HOJE, tipo: 'cafe', alimentoId: arroz, gramas: 45, qtd: 0.25, porcao: 'Xícara' })
  await addRefeicao(b, { data: HOJE, tipo: 'almoco', alimentoId: arroz, gramas: 150 })
  render(<App banco={b} />)
  expect(await screen.findByText('2 × Fatia · 50 g')).toBeInTheDocument()
  expect(screen.getByText('1,5 × Unidade · 75 g')).toBeInTheDocument()
  expect(screen.getByText('0,25 × Xícara · 45 g')).toBeInTheDocument()
  expect(screen.getByText('150 g')).toBeInTheDocument()
})
