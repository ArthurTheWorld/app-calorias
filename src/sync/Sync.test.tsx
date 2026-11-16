import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { abrirBanco, carregarBancoSalvo, type Banco } from '../db/banco'
import { addTreino, salvarPerfil, treinosDoDia } from '../db/repos'
import type { ClienteDrive } from './drive'
import { driveFalso, editadoNoPc, TREINO } from './testes'
import type { DepsSync } from './useSync'

const PERFIL = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M' as const, deficitMeta: 300 }
let b: Banco
beforeEach(async () => {
  await clear()
  localStorage.clear()
  sessionStorage.clear()
  b = await abrirBanco()
  await salvarPerfil(b, PERFIL)
})

function deps(cliente: ClienteDrive, extra: Partial<DepsSync> = {}): DepsSync & { recarregar: ReturnType<typeof vi.fn>; pedirToken: ReturnType<typeof vi.fn> } {
  let token: string | null = null
  return {
    clienteId: 'teste',
    token: () => token,
    pedirToken: vi.fn(async () => { token = 'tok'; return 'tok' }),
    esquecerToken: () => { token = null },
    cliente: () => cliente,
    recarregar: vi.fn(),
    esperaMs: 10,
    ...extra,
  } as never
}

async function abrirPerfil(d: DepsSync) {
  const u = userEvent.setup()
  render(<App banco={b} sync={d} />)
  await u.click(await screen.findByRole('button', { name: 'Perfil' }))
  return u
}

test('sem Client ID: só backup em arquivo, sem CSVs nem Drive', async () => {
  const { cliente } = driveFalso()
  await abrirPerfil(deps(cliente, { clienteId: '' }))
  expect(screen.getByRole('heading', { name: 'Backup e sincronização' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Baixar backup (.sqlite)' })).toBeInTheDocument()
  expect(screen.getByText('Restaurar backup (.sqlite)')).toBeInTheDocument()
  expect(screen.queryByText('Exportar CSVs')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Conectar Google Drive' })).toBeNull()
})

test('conectar pede consentimento, cria o arquivo no Drive e mostra conectado', async () => {
  const { d, cliente } = driveFalso()
  const dp = deps(cliente)
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  expect(dp.pedirToken).toHaveBeenCalledWith('consent')
  expect(await screen.findByText(/Drive conectado · última sincronização hoje/)).toBeInTheDocument()
  expect(d.arquivo).not.toBeNull()
})

test('token vencido ao abrir: faixa discreta; um toque renova e sincroniza', async () => {
  const { d, cliente } = driveFalso()
  localStorage.setItem('drive-conectado', '1')
  await addTreino(b, TREINO)
  const dp = deps(cliente)
  const u = userEvent.setup()
  render(<App banco={b} sync={dp} />)
  await u.click(await screen.findByRole('button', { name: 'Drive: toque para sincronizar' }))
  expect(dp.pedirToken).toHaveBeenCalledWith('')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Drive: toque para sincronizar' })).toBeNull())
  expect(treinosDoDia(await abrirBanco(d.arquivo!.dados), TREINO.data)).toHaveLength(1)
})

test('com token, uma gravação sobe sozinha depois da espera', async () => {
  const { d, cliente } = driveFalso()
  const dp = deps(cliente)
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  await screen.findByText(/Drive conectado/)
  const versao = d.arquivo!.version
  await u.click(screen.getByRole('button', { name: 'Treino' }))
  await u.click(screen.getByRole('button', { name: 'Registrar treino' }))
  await waitFor(() => expect(d.arquivo!.version).toBe(versao + 1))
  expect((await abrirBanco(d.arquivo!.dados)).db.exec('SELECT COUNT(*) FROM treinos')[0].values[0][0]).toBe(1)
})

test('versão nova do PC: troca o banco e recarrega; depois avisa', async () => {
  const { d, cliente } = driveFalso()
  const dp = deps(cliente)
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  await screen.findByText(/Drive conectado/)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, TREINO))
  await u.click(screen.getByRole('button', { name: 'Sincronizar agora' }))
  await waitFor(() => expect(dp.recarregar).toHaveBeenCalled())
  expect(treinosDoDia(await carregarBancoSalvo(), TREINO.data)).toHaveLength(1)
  render(<App banco={await carregarBancoSalvo()} sync={deps(cliente)} />)
  expect(await screen.findByText('Atualizado com a versão do Drive.')).toBeInTheDocument()
})

test('conflito: pergunta na faixa e "Manter a do celular" envia', async () => {
  const { d, cliente } = driveFalso()
  const dp = deps(cliente)
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  await screen.findByText(/Drive conectado/)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' }))
  await act(async () => { await addTreino(b, { ...TREINO, tipo: 'Do celular' }) })
  await u.click(screen.getByRole('button', { name: 'Sincronizar agora' }))
  expect(await screen.findByText('O Drive e o celular mudaram desde a última sincronização. Qual versão manter?')).toBeInTheDocument()
  expect(dp.recarregar).not.toHaveBeenCalled()
  await u.click(screen.getByRole('button', { name: 'Manter a do celular' }))
  await waitFor(() => expect(screen.queryByText(/Qual versão manter/)).toBeNull())
  expect(treinosDoDia(await abrirBanco(d.arquivo!.dados), TREINO.data).map((t) => t.tipo)).toEqual(['Do celular'])
})

test('falha de rede: mensagem neutra, nada se perde', async () => {
  const { cliente } = driveFalso()
  const dp = deps({ ...cliente, procurar: async () => { throw new Error('offline') } })
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  expect(await screen.findByText('Não deu para sincronizar agora. Tente de novo mais tarde.')).toBeInTheDocument()
})
