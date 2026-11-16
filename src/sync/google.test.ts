import { beforeEach, expect, test } from 'vitest'
import { esquecerToken, guardarToken, tokenValido } from './google'

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
