import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { abrirBanco, carregarBancoSalvo, type Banco } from '../db/banco'
import { addTreino, salvarPerfil, treinosDoDia } from '../db/repos'
import { ErroDrive, type ClienteDrive } from './drive'
import { gravarEstadoSync } from './estado'
import { sincronizar } from './motor'
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

function deps(cliente: ClienteDrive, extra: Partial<DepsSync> & { tokenInicial?: string } = {}): DepsSync & { recarregar: ReturnType<typeof vi.fn>; pedirToken: ReturnType<typeof vi.fn> } {
  let token: string | null = extra.tokenInicial ?? null
  return {
    clienteId: 'teste',
    token: () => token,
    pedirToken: vi.fn(async () => { token = 'tok'; return 'tok' }),
    esquecerToken: () => { token = null },
    cliente: () => cliente,
    recarregar: vi.fn(),
    esperaMs: 10,
    preparar: vi.fn(async () => {}),
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
  await waitFor(() => expect(d.arquivo).not.toBeNull())
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
  await waitFor(() => expect(d.arquivo).not.toBeNull())
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
  await waitFor(() => expect(d.arquivo).not.toBeNull())
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

test('arquivo sumiu do Drive: avisa e só recria com um toque', async () => {
  const { d, cliente } = driveFalso()
  localStorage.setItem('drive-conectado', '1')
  await gravarEstadoSync({ fileId: 'apagado', versaoRemota: 'r1', seqSincronizado: 0 })
  const u = userEvent.setup()
  render(<App banco={b} sync={deps(cliente, { tokenInicial: 'tok' })} />)
  expect(await screen.findByText('Não achei o arquivo do app no Drive.')).toBeInTheDocument()
  expect(d.arquivo).toBeNull()
  await u.click(screen.getByRole('button', { name: 'Criar de novo no Drive' }))
  await waitFor(() => expect(d.arquivo).not.toBeNull())
  await waitFor(() => expect(screen.queryByText('Não achei o arquivo do app no Drive.')).toBeNull())
})

test('gravação durante uma sincronização em andamento roda de novo no fim', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  await addTreino(b, TREINO)
  let soltar!: () => void
  const portao = new Promise<void>((r) => { soltar = r })
  let primeira = true
  const lento: ClienteDrive = { ...cliente, atualizar: async (id, dados) => { if (primeira) { primeira = false; await portao } return cliente.atualizar(id, dados) } }
  localStorage.setItem('drive-conectado', '1')
  const u = userEvent.setup()
  render(<App banco={b} sync={deps(lento, { tokenInicial: 'tok' })} />)
  await u.click(await screen.findByRole('button', { name: 'Treino' }))
  await u.click(screen.getByRole('button', { name: 'Registrar treino' }))
  await new Promise((r) => setTimeout(r, 50))
  soltar()
  await waitFor(async () => expect((await abrirBanco(d.arquivo!.dados)).db.exec('SELECT COUNT(*) FROM treinos')[0].values[0][0]).toBe(2))
})

test('Drive recusa a permissão (403): pede o toque para entrar de novo', async () => {
  const { cliente } = driveFalso()
  localStorage.setItem('drive-conectado', '1')
  render(<App banco={b} sync={deps({ ...cliente, procurar: async () => { throw new ErroDrive(403, 'sem permissão') } }, { tokenInicial: 'tok' })} />)
  expect(await screen.findByRole('button', { name: 'Drive: toque para sincronizar' })).toBeInTheDocument()
})

test('erro do login aparece com a mensagem do Google', async () => {
  const { cliente } = driveFalso()
  const dp = deps(cliente, { pedirToken: vi.fn(async () => { throw new Error('Permita o acesso ao Google Drive para sincronizar.') }) })
  const u = await abrirPerfil(dp)
  await u.click(screen.getByRole('button', { name: 'Conectar Google Drive' }))
  expect(await screen.findByText('Permita o acesso ao Google Drive para sincronizar.')).toBeInTheDocument()
})

test('com Client ID, o Google é preparado ao abrir (para o toque não ser bloqueado)', async () => {
  const { cliente } = driveFalso()
  const dp = deps(cliente)
  render(<App banco={b} sync={dp} />)
  await waitFor(() => expect(dp.preparar).toHaveBeenCalled())
})
