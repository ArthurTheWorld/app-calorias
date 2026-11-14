import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { abrirBanco, type Banco } from '../db/banco'
import { addRefeicao, criarAlimento, salvarPerfil } from '../db/repos'
import { hojeLocal } from '../calc/datas'
import { metaConsumo } from '../calc/energia'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
let b: Banco
beforeEach(async () => { b = await abrirBanco() })

test('sem perfil abre o Perfil', async () => {
  render(<App banco={b} />)
  expect(await screen.findByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument()
})

test('Hoje mostra consumido e restante', async () => {
  await salvarPerfil(b, perfil)
  const id = await criarAlimento(b, { nome: 'Arroz', kcal100g: 128, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  await addRefeicao(b, { data: hojeLocal(), tipo: 'almoco', alimentoId: id, gramas: 150 })
  render(<App banco={b} />)
  expect(await screen.findByTestId('consumido')).toHaveTextContent('192')
  expect(screen.getByTestId('restante')).toHaveTextContent(String(Math.round(metaConsumo(perfil, 0) - 192)))
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
