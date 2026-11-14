import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { abrirBanco, type Banco } from '../db/banco'
import { addRefeicao, criarAlimento, salvarPerfil } from '../db/repos'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
let b: Banco
let id: number

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0))
  b = await abrirBanco()
  await salvarPerfil(b, perfil)
  id = await criarAlimento(b, { nome: 'X', kcal100g: 100, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
})
afterEach(() => { vi.useRealTimers() })

test('calendário marca dias e navega meses', async () => {
  await addRefeicao(b, { data: '2026-11-01', tipo: 'almoco', alimentoId: id, gramas: 1000 })
  await addRefeicao(b, { data: '2026-11-02', tipo: 'almoco', alimentoId: id, gramas: 1000 })
  await addRefeicao(b, { data: '2026-11-03', tipo: 'almoco', alimentoId: id, gramas: 5000 })

  const u = userEvent.setup()
  const { container } = render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Histórico' }))
  expect(container.querySelectorAll('[data-estado="deficit"]')).toHaveLength(2)
  expect(container.querySelectorAll('[data-estado="acima"]')).toHaveLength(1)
  expect(screen.getByTestId('recorde')).toHaveTextContent('2')
  expect(screen.getByTestId('dias-deficit-mes')).toHaveTextContent('2 de 3')

  const titulo = screen.getByTestId('mes-titulo').textContent
  await u.click(screen.getByRole('button', { name: 'Mês anterior' }))
  expect(screen.getByTestId('mes-titulo').textContent).not.toBe(titulo)
  expect(container.querySelectorAll('[data-estado="deficit"]')).toHaveLength(0)
})

test('hoje, ainda aberto, não soma na sequência', async () => {
  await addRefeicao(b, { data: '2026-11-13', tipo: 'almoco', alimentoId: id, gramas: 1000 })
  await addRefeicao(b, { data: '2026-11-14', tipo: 'almoco', alimentoId: id, gramas: 1000 })
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Histórico' }))
  expect(screen.getByTestId('streak-atual')).toHaveTextContent('1')
  expect(screen.getByTestId('recorde')).toHaveTextContent('1')
})

test('lista as 9 conquistas, com as bloqueadas marcadas', async () => {
  await addRefeicao(b, { data: '2026-11-13', tipo: 'almoco', alimentoId: id, gramas: 100 })
  const u = userEvent.setup()
  const { container } = render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Histórico' }))
  expect(container.querySelectorAll('[data-conquista]')).toHaveLength(9)
  expect(container.querySelectorAll('[data-bloqueada="true"]')).toHaveLength(8)
  expect(container.querySelector('[data-conquista="primeiro-registro"]')).toHaveAttribute('data-bloqueada', 'false')
})
