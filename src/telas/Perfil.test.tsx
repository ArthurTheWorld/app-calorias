import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from '../App'
import { abrirBanco } from '../db/banco'
import { addRefeicao, adicionarApelido, criarAlimento, salvarPerfil } from '../db/repos'

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
  expect(screen.queryByText('Seus apelidos')).toBeNull()
})
