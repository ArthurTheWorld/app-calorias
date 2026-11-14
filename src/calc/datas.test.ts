import { expect, test } from 'vitest'
import { dataParaRefeicao, diasEntre, hojeApp, hojeLocal, nomeDiaSemana, parseGramas } from './datas'

test('hojeLocal 23h', () => expect(hojeLocal(new Date(2026, 10, 14, 23, 30))).toBe('2026-11-14'))
test('hojeLocal 00h05', () => expect(hojeLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01'))
test('gramas vírgula', () => expect(parseGramas('150,5')).toBe(150.5))
test('gramas inválidas', () => {
  expect(parseGramas('0')).toBeNull()
  expect(parseGramas('')).toBeNull()
  expect(parseGramas('-3')).toBeNull()
  expect(parseGramas('abc')).toBeNull()
})

test('hojeApp antes das 5h é ontem', () => expect(hojeApp(new Date(2026, 10, 15, 2, 0))).toBe('2026-11-14'))
test('hojeApp às 5h vira', () => expect(hojeApp(new Date(2026, 10, 15, 5, 0))).toBe('2026-11-15'))
test('hojeApp vira o ano às 5h', () => expect(hojeApp(new Date(2027, 0, 1, 4, 59))).toBe('2026-12-31'))
test('madrugada de manhã vai pro dia anterior', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-15', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-14'))
test('madrugada ao meio-dia fica no dia', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-15', new Date(2026, 10, 15, 12, 0))).toBe('2026-11-15'))
test('madrugada às 2h fica no dia do app', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-14', new Date(2026, 10, 15, 2, 0))).toBe('2026-11-14'))
test('madrugada num dia passado fica no dia da tela', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-10', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-10'))
test('outras refeições não mudam', () =>
  expect(dataParaRefeicao('jantar', '2026-11-15', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-15'))
test('diasEntre', () => {
  expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3)
  expect(diasEntre('2026-11-02', '2026-11-02')).toBe(0)
  expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2)
})
test('nomeDiaSemana', () => {
  expect(nomeDiaSemana('2026-11-13')).toBe('sexta')
  expect(nomeDiaSemana('2026-11-15')).toBe('domingo')
})
