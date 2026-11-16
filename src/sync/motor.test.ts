import { clear } from 'idb-keyval'
import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, carregarBancoSalvo, lerSeqLocal, type Banco } from '../db/banco'
import { addTreino, treinosDoDia } from '../db/repos'
import { decidir } from './decidir'
import { gravarEstadoSync, lerEstadoSync } from './estado'
import { sincronizar } from './motor'
import { driveFalso, editadoNoPc, TREINO } from './testes'

let b: Banco
beforeEach(async () => {
  await clear()
  b = await abrirBanco()
})

test('decidir: criar, baixar, enviar, conflito, nada', () => {
  const estado = { fileId: 'f1', versaoRemota: '3', seqSincronizado: 5, ultima: null }
  expect(decidir({ remoto: null, estado, seqLocal: 5 })).toBe('criar')
  expect(decidir({ remoto: { id: 'f1', version: '4' }, estado, seqLocal: 5 })).toBe('baixar')
  expect(decidir({ remoto: { id: 'f1', version: '3' }, estado, seqLocal: 6 })).toBe('enviar')
  expect(decidir({ remoto: { id: 'f1', version: '4' }, estado, seqLocal: 6 })).toBe('conflito')
  expect(decidir({ remoto: { id: 'f1', version: '3' }, estado, seqLocal: 5 })).toBe('nada')
})

test('primeira vez cria o arquivo e marca o que foi enviado', async () => {
  const { d, cliente } = driveFalso()
  await addTreino(b, TREINO)
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'criado' })
  expect(d.arquivo?.dados).toEqual(b.exportar())
  expect(await lerEstadoSync()).toMatchObject({ fileId: 'f1', versaoRemota: '1', seqSincronizado: await lerSeqLocal() })
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'nada' })
})

test('gravação no meio do envio continua pendente', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  await addTreino(b, TREINO)
  d.antesDeGravar = async () => { d.antesDeGravar = null; await addTreino(b, { ...TREINO, tipo: 'Corrida' }) }
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'enviado' })
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'enviado' })
  const noDrive = await abrirBanco(d.arquivo!.dados)
  expect(treinosDoDia(noDrive, '2026-11-16').map((t) => t.tipo).sort()).toEqual(['Corrida', 'Musculação'])
})

test('versão nova do PC e celular sem mudança: baixa e grava no aparelho', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, TREINO))
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'baixado' })
  expect(treinosDoDia(await carregarBancoSalvo(), '2026-11-16')).toHaveLength(1)
  expect(await lerEstadoSync()).toMatchObject({ versaoRemota: '2', seqSincronizado: await lerSeqLocal() })
})

test('os dois mudaram: pergunta sem mexer em nada; resolver escolhe o lado', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' }))
  await addTreino(b, { ...TREINO, tipo: 'Do celular' })
  const antes = d.arquivo!.dados
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'conflito' })
  expect(d.arquivo!.dados).toBe(antes)
  expect(treinosDoDia(await carregarBancoSalvo(), '2026-11-16').map((t) => t.tipo)).toEqual(['Do celular'])

  expect(await sincronizar(b, cliente, 'celular')).toEqual({ tipo: 'enviado' })
  expect(treinosDoDia(await abrirBanco(d.arquivo!.dados), '2026-11-16').map((t) => t.tipo)).toEqual(['Do celular'])
})

test('resolver pelo Drive baixa a versão do PC', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' }))
  await addTreino(b, { ...TREINO, tipo: 'Do celular' })
  expect(await sincronizar(b, cliente, 'drive')).toEqual({ tipo: 'baixado' })
  expect(treinosDoDia(await carregarBancoSalvo(), '2026-11-16').map((t) => t.tipo)).toEqual(['Do PC'])
})

test('arquivo inválido no Drive não substitui o banco do aparelho', async () => {
  const { d, cliente } = driveFalso()
  await addTreino(b, TREINO)
  await sincronizar(b, cliente)
  const seq = await lerSeqLocal()
  d.gravarPeloPc(new TextEncoder().encode('não é sqlite'))
  await expect(sincronizar(b, cliente)).rejects.toThrow()
  expect(treinosDoDia(await carregarBancoSalvo(), '2026-11-16')).toHaveLength(1)
  expect(await lerSeqLocal()).toBe(seq)
  expect((await lerEstadoSync()).versaoRemota).toBe('1')
})

test('arquivo sumiu do Drive: não recria sozinho; recria só com "recriar"', async () => {
  const { d, cliente } = driveFalso()
  await gravarEstadoSync({ fileId: 'sumiu', versaoRemota: '9', seqSincronizado: 0 })
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'sumiu' })
  expect(d.arquivo).toBeNull()
  expect(await sincronizar(b, cliente, 'recriar')).toEqual({ tipo: 'criado' })
  expect(d.arquivo?.id).toBe('f1')
})

test('gravação no celular durante o download: não sobrescreve, vira conflito', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' }))
  const lento: typeof cliente = { ...cliente, baixar: async (id) => { await addTreino(b, { ...TREINO, tipo: 'Refeição no meio' }); return cliente.baixar(id) } }
  expect(await sincronizar(b, lento)).toEqual({ tipo: 'conflito' })
  expect(treinosDoDia(await carregarBancoSalvo(), TREINO.data).map((t) => t.tipo)).toEqual(['Refeição no meio'])
})

test('depois de baixar, gravações do banco antigo em memória não chegam ao aparelho', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  d.gravarPeloPc(await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' }))
  expect(await sincronizar(b, cliente)).toEqual({ tipo: 'baixado' })
  const seq = await lerSeqLocal()
  await addTreino(b, { ...TREINO, tipo: 'Antigo' })
  expect(await lerSeqLocal()).toBe(seq)
  expect(treinosDoDia(await carregarBancoSalvo(), TREINO.data).map((t) => t.tipo)).toEqual(['Do PC'])
})

test('arquivo truncado no Drive é recusado', async () => {
  const { d, cliente } = driveFalso()
  await addTreino(b, TREINO)
  await sincronizar(b, cliente)
  const pc = await editadoNoPc(d.arquivo!.dados, { ...TREINO, tipo: 'Do PC' })
  d.gravarPeloPc(pc.slice(0, Math.floor(pc.length * 0.6)))
  await expect(sincronizar(b, cliente)).rejects.toThrow()
  expect(treinosDoDia(await carregarBancoSalvo(), TREINO.data)).toHaveLength(1)
})

test('banco em modo WAL no Drive é recusado (os dados recentes ficam fora do arquivo)', async () => {
  const { d, cliente } = driveFalso()
  await sincronizar(b, cliente)
  const wal = (await editadoNoPc(d.arquivo!.dados, TREINO)).slice()
  wal[18] = 2
  wal[19] = 2
  d.gravarPeloPc(wal)
  await expect(sincronizar(b, cliente)).rejects.toThrow()
})
