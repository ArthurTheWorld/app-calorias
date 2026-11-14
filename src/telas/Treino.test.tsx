import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from '../App'
import { abrirBanco } from '../db/banco'
import { salvarPerfil } from '../db/repos'
import { gastoDia } from '../calc/energia'

const perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }

test('registrar treino sugere kcal e aumenta o gasto do dia', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, perfil)
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Treino' }))
  await u.selectOptions(screen.getByLabelText('Tipo'), 'Musculação')
  const dur = screen.getByLabelText('Duração (min)')
  await u.clear(dur)
  await u.type(dur, '60')
  expect(screen.getByLabelText('kcal gastas')).toHaveValue('400')
  await u.click(screen.getByRole('button', { name: 'Registrar treino' }))
  expect(await screen.findByText(/Musculação · 60 min · 400 kcal/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Hoje' }))
  expect(await screen.findByText(String(Math.round(gastoDia(perfil, 400))))).toBeInTheDocument()
})
