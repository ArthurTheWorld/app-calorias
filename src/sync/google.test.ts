import { beforeEach, expect, test } from 'vitest'
import { esquecerToken, guardarToken, pedirToken, prepararGoogle, tokenValido } from './google'

beforeEach(() => localStorage.clear())

test('token ausente, válido e vencendo (margem de 1 minuto)', () => {
  const agora = 1_000_000
  expect(tokenValido(agora)).toBeNull()
  guardarToken('abc', 3600, agora)
  expect(tokenValido(agora + 10_000)).toBe('abc')
  expect(tokenValido(agora + 3600_000 - 30_000)).toBeNull()
  guardarToken('abc', 3600, agora)
  esquecerToken()
  expect(tokenValido(agora)).toBeNull()
})

test('token corrompido no armazenamento conta como ausente', () => {
  localStorage.setItem('drive-token', '{quebrado')
  expect(tokenValido()).toBeNull()
})

function gisFalso(concedeuTudo = true) {
  const g = {
    pedidos: [] as string[],
    callback: null as null | ((r: { access_token?: string; expires_in?: number }) => void),
    accounts: { oauth2: {
      initTokenClient: (c: { callback: (r: { access_token?: string; expires_in?: number }) => void }) => {
        g.callback = c.callback
        return { requestAccessToken: (o: { prompt: string }) => { g.pedidos.push(o.prompt) } }
      },
      hasGrantedAllScopes: () => concedeuTudo,
    } },
  }
  ;(window as unknown as { google: unknown }).google = g
  return g
}

test('com o Google preparado, o pedido de token sai na hora do toque (sem esperar nada antes)', async () => {
  const g = gisFalso()
  await prepararGoogle()
  const p = pedirToken('')
  expect(g.pedidos).toEqual([''])
  g.callback!({ access_token: 'novo', expires_in: 3600 })
  expect(await p).toBe('novo')
  expect(tokenValido()).toBe('novo')
})

test('sem permissão do Drive marcada: recusa com mensagem clara e não guarda token', async () => {
  const g = gisFalso(false)
  await prepararGoogle()
  const p = pedirToken('consent')
  g.callback!({ access_token: 'parcial', expires_in: 3600 })
  await expect(p).rejects.toThrow('Permita o acesso ao Google Drive para sincronizar.')
  expect(tokenValido()).toBeNull()
})
