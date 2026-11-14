import tacoJson from '../../public/taco.json'
import { beforeEach, expect, test } from 'vitest'
import { abrirBanco, consultar, type Banco } from './banco'
import { APELIDOS_LISTA, sincronizarApelidosLista } from './apelidos'
import { adicionarApelido, apelidosDoUsuario, criarAlimento } from './repos'

const taco = new Set((tacoJson as { nome: string }[]).map((a) => a.nome))
const base = { kcal100g: 100, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'TACO' as const }
const contarLista = (b: Banco) =>
  consultar<{ n: number }>(b, "SELECT COUNT(*) AS n FROM apelidos WHERE origem = 'lista'")[0].n

let b: Banco
beforeEach(async () => { b = await abrirBanco() })

test('todo nome da lista existe na TACO', () => {
  const faltando = Object.keys(APELIDOS_LISTA).filter((n) => !taco.has(n))
  expect(faltando).toEqual([])
  expect(Object.keys(APELIDOS_LISTA).length).toBeGreaterThanOrEqual(40)
})

test('a lista cobre os nomes do dia a dia combinados', () => {
  expect(APELIDOS_LISTA['Arroz, tipo 1, cozido']).toContain('arroz branco')
  expect(APELIDOS_LISTA['Carne, bovina, acém, moído, cozido']).toContain('carne moída')
  expect(APELIDOS_LISTA['Pão, trigo, francês']).toContain('pãozinho')
  expect(APELIDOS_LISTA['Frango, peito, sem pele, grelhado']).toContain('peito de frango')
})

test('sincronizar é estável, ignora nome inexistente e preserva apelidos do usuário', async () => {
  const arroz = await criarAlimento(b, { ...base, nome: 'Arroz, tipo 1, cozido' })
  await criarAlimento(b, { ...base, nome: 'Pão, trigo, francês' })
  await adicionarApelido(b, arroz, 'marmita')
  const lista = { 'Arroz, tipo 1, cozido': ['arroz', 'arroz branco'], 'Pão, trigo, francês': ['pãozinho'], 'Não existe': ['x'] }
  sincronizarApelidosLista(b, lista)
  sincronizarApelidosLista(b, lista)
  expect(contarLista(b)).toBe(3)
  expect(apelidosDoUsuario(b).map((a) => a.termo)).toEqual(['marmita'])
  sincronizarApelidosLista(b, { 'Pão, trigo, francês': ['pãozinho'] })
  expect(contarLista(b)).toBe(1)
  expect(apelidosDoUsuario(b)).toHaveLength(1)
})
