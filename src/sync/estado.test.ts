import { clear } from 'idb-keyval'
import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, lerSeqLocal } from '../db/banco'
import { gravarEstadoSync, lerEstadoSync, limparEstadoSync } from './estado'

beforeEach(async () => { await clear() })

test('cada salvar soma 1 no contador de gravações', async () => {
  const b = await abrirBanco()
  expect(await lerSeqLocal()).toBe(0)
  await b.salvar()
  await b.salvar()
  expect(await lerSeqLocal()).toBe(2)
})

test('estado da sincronização: padrão, gravação parcial e limpeza', async () => {
  expect(await lerEstadoSync()).toEqual({ fileId: null, versaoRemota: null, seqSincronizado: 0, ultima: null })
  await gravarEstadoSync({ fileId: 'f1', versaoRemota: '7' })
  await gravarEstadoSync({ seqSincronizado: 3 })
  expect(await lerEstadoSync()).toEqual({ fileId: 'f1', versaoRemota: '7', seqSincronizado: 3, ultima: null })
  await limparEstadoSync()
  expect((await lerEstadoSync()).fileId).toBeNull()
})
