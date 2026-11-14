import { expect, test } from 'vitest'
import { hojeLocal, parseGramas } from './datas'

test('hojeLocal 23h', () => expect(hojeLocal(new Date(2026, 10, 14, 23, 30))).toBe('2026-11-14'))
test('hojeLocal 00h05', () => expect(hojeLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01'))
test('gramas vírgula', () => expect(parseGramas('150,5')).toBe(150.5))
test('gramas inválidas', () => {
  expect(parseGramas('0')).toBeNull()
  expect(parseGramas('')).toBeNull()
  expect(parseGramas('-3')).toBeNull()
  expect(parseGramas('abc')).toBeNull()
})
