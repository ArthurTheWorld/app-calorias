import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from '../App'
import { abrirBanco } from '../db/banco'
import { addRefeicao, criarAlimento, salvarPerfil } from '../db/repos'
import { hojeLocal } from '../calc/datas'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }

test('calendário marca dias e navega meses', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, perfil)
  const id = await criarAlimento(b, { nome: 'X', kcal100g: 100, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  const mes = hojeLocal().slice(0, 7)
  await addRefeicao(b, { data: `${mes}-01`, tipo: 'almoco', alimentoId: id, gramas: 1000 })
  await addRefeicao(b, { data: `${mes}-02`, tipo: 'almoco', alimentoId: id, gramas: 1000 })
  await addRefeicao(b, { data: `${mes}-03`, tipo: 'almoco', alimentoId: id, gramas: 5000 })

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
