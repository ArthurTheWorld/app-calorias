import { expect, test } from 'vitest'
import { abrirBanco } from './banco'
import { buscarAlimentos } from './repos'
import { normalizarTaco, semearTaco } from './seed'

test('normalizarTaco converte Tr em 0 e pula kcal ausente', () => {
  const itens = normalizarTaco([
    { description: 'Arroz, integral, cozido', energy_kcal: 123.53, protein_g: 2.59, carbohydrate_g: 25.8, lipid_g: 'Tr' },
    { description: 'Sem kcal', energy_kcal: 'NA', protein_g: 1, carbohydrate_g: 1, lipid_g: 1 },
  ])
  expect(itens).toEqual([
    { nome: 'Arroz, integral, cozido', kcal100g: 124, proteinaG: 2.6, carboG: 25.8, gorduraG: 0 },
  ])
})

test('semear duas vezes não duplica', async () => {
  const b = await abrirBanco()
  const itens = [{ nome: 'Banana, prata, crua', kcal100g: 98, proteinaG: 1.3, carboG: 26, gorduraG: 0.1 }]
  expect(semearTaco(b, itens)).toBe(1)
  expect(semearTaco(b, itens)).toBe(0)
  expect(buscarAlimentos(b, 'banana')).toHaveLength(1)
})
