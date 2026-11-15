import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import App from '../App'
import { ProvedorBanco } from '../estado'
import { Treino } from './Treino'
import { abrirBanco } from '../db/banco'
import { registrarPeso, salvarPerfil, treinosDoDia } from '../db/repos'
import { gastoDia, kcalTreino } from '../calc/energia'
import { METS } from '../calc/mets'

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
  expect(await screen.findByTestId('gasto')).toHaveTextContent(String(Math.round(gastoDia(perfil, 400))))
})

test('treino às 2h é salvo no dia do app (o anterior)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 2, 0))
  try {
    const b = await abrirBanco()
    await salvarPerfil(b, perfil)
    const u = userEvent.setup()
    render(<App banco={b} />)
    await u.click(await screen.findByRole('button', { name: 'Treino' }))
    await u.click(screen.getByRole('button', { name: 'Registrar treino' }))
    expect(treinosDoDia(b, '2026-11-14')).toHaveLength(1)
    expect(treinosDoDia(b, '2026-11-15')).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
})

test('sugestão do treino usa o peso mais recente', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, perfil)
  await registrarPeso(b, '2026-11-01', 60)
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Treino' }))
  await u.selectOptions(screen.getByLabelText('Tipo'), 'Musculação')
  const dur = screen.getByLabelText('Duração (min)')
  await u.clear(dur)
  await u.type(dur, '60')
  expect(screen.getByLabelText('kcal gastas')).toHaveValue(String(kcalTreino(METS['Musculação']!, 60, 60)))
})

test('com a ficha vazia a aba Treino não mostra divisões', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, perfil)
  const u = userEvent.setup()
  render(<App banco={b} />)
  await u.click(await screen.findByRole('button', { name: 'Treino' }))
  expect(screen.getByRole('button', { name: 'Registrar treino' })).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Divisão' })).not.toBeInTheDocument()
})

test('com ficha, a aba Treino mostra a ficha acima do registro de kcal', async () => {
  const b = await abrirBanco()
  await salvarPerfil(b, perfil)
  render(
    <ProvedorBanco banco={b}>
      <Treino perfil={perfil} ficha={[{ nome: 'A', exercicios: [{ nome: 'Supino reto', series: 4, reps: '10' }] }]} />
    </ProvedorBanco>,
  )
  expect(screen.getByRole('radiogroup', { name: 'Divisão' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Supino reto' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Registrar treino' })).toBeInTheDocument()
})
