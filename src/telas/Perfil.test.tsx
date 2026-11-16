import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { abrirBanco } from '../db/banco'
import { addRefeicao, adicionarApelido, adicionarPorcao, criarAlimento, getPerfil, pesosRegistrados, registrarPeso, salvarPerfil } from '../db/repos'

test('perfil mostra nível e barra de xp', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 300 })
  const id = await criarAlimento(b, { nome: 'X', kcal100g: 100, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  await addRefeicao(b, { data: '2026-11-01', tipo: 'almoco', alimentoId: id, gramas: 100 })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Perfil' }))
  expect(screen.getByText('LV 1')).toBeInTheDocument()
  expect(screen.getByText('15 / 100 XP')).toBeInTheDocument()
  expect(screen.getByTestId('xp-barra')).toBeInTheDocument()
})

test('perfil lista e remove apelidos do usuário', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 300 })
  const id = await criarAlimento(b, { nome: 'Arroz', kcal100g: 128, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Perfil' }))
  expect(screen.queryByText('Seus apelidos')).toBeNull()
  await act(async () => { await adicionarApelido(b, id, 'marmita') })
  await u.click(screen.getByRole('button', { name: 'Hoje' }))
  await u.click(screen.getByRole('button', { name: 'Perfil' }))
  expect(screen.getByText('Seus apelidos')).toBeInTheDocument()
  expect(screen.getByText('marmita → Arroz')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Remover apelido marmita' }))
  await waitFor(() => expect(screen.queryByText('Seus apelidos')).toBeNull())
})

describe('peso', () => {
  const p = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0))
  })
  afterEach(() => { vi.useRealTimers() })

  test('primeiro cadastro registra o primeiro peso', async () => {
    const b = await abrirBanco()
    const u = userEvent.setup()
    render(<App banco={b} />)
    await u.type(await screen.findByLabelText('Altura (cm)'), '175')
    await u.type(screen.getByLabelText('Peso (kg)'), '82')
    await u.type(screen.getByLabelText('Idade'), '30')
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(pesosRegistrados(b).map((x) => [x.data, x.pesoKg])).toEqual([['2026-11-14', 82]])
  })

  test('com perfil: sem campo de peso no formulário; cartão registra com vírgula', async () => {
    const b = await abrirBanco()
    await salvarPerfil(b, p)
    await registrarPeso(b, '2026-11-01', 80)
    const u = userEvent.setup()
    render(<App banco={b} />)
    await u.click(await screen.findByRole('button', { name: 'Perfil' }))
    expect(screen.queryByLabelText('Peso (kg)')).toBeNull()
    await u.type(screen.getByLabelText('Peso de hoje (kg)'), '79,5')
    await u.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByText('79,5 kg')).toBeInTheDocument()
    expect(getPerfil(b)?.pesoKg).toBe(79.5)
  })

  test('registrar de madrugada vai pro dia do app', async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 2, 0))
    const b = await abrirBanco()
    await salvarPerfil(b, p)
    await registrarPeso(b, '2026-11-01', 80)
    const u = userEvent.setup()
    render(<App banco={b} />)
    await u.click(await screen.findByRole('button', { name: 'Perfil' }))
    await u.type(screen.getByLabelText('Peso de hoje (kg)'), '79')
    await u.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(pesosRegistrados(b).map((x) => x.data)).toEqual(['2026-11-01', '2026-11-14'])
  })

  test('apagar pesagem; o último registro não tem botão de apagar', async () => {
    const b = await abrirBanco()
    await salvarPerfil(b, p)
    await registrarPeso(b, '2026-11-01', 80)
    await registrarPeso(b, '2026-11-14', 79)
    const u = userEvent.setup()
    render(<App banco={b} />)
    await u.click(await screen.findByRole('button', { name: 'Perfil' }))
    await u.click(screen.getByRole('button', { name: 'Apagar peso de 14/11/2026' }))
    expect(pesosRegistrados(b)).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Apagar peso/ })).toBeNull())
  })
})

test('perfil lista e remove porções do usuário, sem as da lista', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 300 })
  const id = await criarAlimento(b, { nome: 'Café', kcal100g: 9, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  b.db.run("INSERT INTO porcoes (alimento_id, nome, gramas, origem) VALUES (?, 'Xícara (180 ml)', 180, 'lista')", [id])
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Perfil' }))
  expect(screen.queryByText('Suas porções')).toBeNull()
  await act(async () => { await adicionarPorcao(b, id, 'Minha caneca', 250) })
  await u.click(screen.getByRole('button', { name: 'Hoje' }))
  await u.click(screen.getByRole('button', { name: 'Perfil' }))
  expect(screen.getByText('Suas porções')).toBeInTheDocument()
  expect(screen.getByText('Minha caneca · 250 g → Café')).toBeInTheDocument()
  expect(screen.queryByText(/Xícara/)).toBeNull()
  await u.click(screen.getByRole('button', { name: 'Remover porção Minha caneca' }))
  await waitFor(() => expect(screen.queryByText('Suas porções')).toBeNull())
})

test('cartão Tema: cinco cores, um toque troca o destaque e fica marcado', async () => {
  localStorage.clear()
  const b = await abrirBanco()
  await salvarPerfil(b, { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 300 })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Perfil' }))
  const grupo = screen.getByRole('radiogroup', { name: 'Tema' })
  expect(within(grupo).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Roxo', 'Verde', 'Rosa neon', 'Vermelho', 'Laranja'])
  expect(within(grupo).getByRole('radio', { name: 'Roxo' })).toHaveAttribute('aria-checked', 'true')
  await u.click(within(grupo).getByRole('radio', { name: 'Rosa neon' }))
  expect(within(grupo).getByRole('radio', { name: 'Rosa neon' })).toHaveAttribute('aria-checked', 'true')
  expect(document.documentElement.style.getPropertyValue('--acento')).toBe('#ff4fd8')
  expect(localStorage.getItem('tema')).toBe('rosa')
})
