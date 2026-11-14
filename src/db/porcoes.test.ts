import { expect, test } from 'vitest'
import { abrirBanco } from './banco'
import {
  addRefeicao, adicionarPorcao, criarAlimento, porcoesDoAlimento, porcoesDoUsuario, refeicoesDoDia,
  removerPorcao, ultimoUso,
} from './repos'

async function comPao() {
  const b = await abrirBanco()
  const id = await criarAlimento(b, { nome: 'Pão de forma', kcal100g: 260, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  return { b, id }
}

test('porções da lista vêm antes das do usuário', async () => {
  const { b, id } = await comPao()
  await adicionarPorcao(b, id, '  Fatia grossa ', 40)
  b.db.run("INSERT INTO porcoes (alimento_id, nome, gramas, origem) VALUES (?, 'Fatia', 25, 'lista')", [id])
  expect(porcoesDoAlimento(b, id).map((p) => [p.nome, p.gramas, p.origem])).toEqual([
    ['Fatia', 25, 'lista'], ['Fatia grossa', 40, 'usuario'],
  ])
  expect(porcoesDoUsuario(b).map((p) => [p.nome, p.nomeAlimento])).toEqual([['Fatia grossa', 'Pão de forma']])
})

test('removerPorcao não apaga porção da lista', async () => {
  const { b, id } = await comPao()
  b.db.run("INSERT INTO porcoes (alimento_id, nome, gramas, origem) VALUES (?, 'Fatia', 25, 'lista')", [id])
  const [lista] = porcoesDoAlimento(b, id)
  await removerPorcao(b, lista.id)
  expect(porcoesDoAlimento(b, id)).toHaveLength(1)
  const meu = await adicionarPorcao(b, id, 'Minha', 30)
  await removerPorcao(b, meu)
  expect(porcoesDoAlimento(b, id)).toHaveLength(1)
})

test('refeição guarda quantidade e porção', async () => {
  const { b, id } = await comPao()
  await addRefeicao(b, { data: '2026-11-14', tipo: 'cafe', alimentoId: id, gramas: 50, qtd: 2, porcao: 'Fatia' })
  const [r] = refeicoesDoDia(b, '2026-11-14')
  expect([r.gramas, r.qtd, r.porcao, r.kcal]).toEqual([50, 2, 'Fatia', 130])
})

test('ultimoUso traz o registro mais recente do alimento', async () => {
  const { b, id } = await comPao()
  expect(ultimoUso(b, id)).toBeNull()
  await addRefeicao(b, { data: '2026-11-14', tipo: 'cafe', alimentoId: id, gramas: 50, qtd: 2, porcao: 'Fatia' })
  await addRefeicao(b, { data: '2026-11-13', tipo: 'cafe', alimentoId: id, gramas: 80 })
  expect(ultimoUso(b, id)).toEqual({ porcao: null, qtd: null, gramas: 80 })
})

import tacoJson from '../../public/taco.json'
import { inserirAlimentoSemSalvar } from './repos'
import { PORCOES_LISTA, sincronizarPorcoesLista } from './porcoes'

const taco = new Set((tacoJson as { nome: string }[]).map((a) => a.nome))

async function comCafe() {
  const b = await abrirBanco()
  const id = inserirAlimentoSemSalvar(b, { nome: 'Café, infusão 10%', kcal100g: 9, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'TACO' })
  return { b, id }
}

test('sincroniza a lista e ignora nomes inexistentes', async () => {
  const { b, id } = await comCafe()
  sincronizarPorcoesLista(b, { 'Café, infusão 10%': [['Xícara (180 ml)', 180]], 'Não existe': [['X', 1]] })
  expect(porcoesDoAlimento(b, id).map((p) => [p.nome, p.gramas, p.origem])).toEqual([['Xícara (180 ml)', 180, 'lista']])
  expect(b.db.exec('SELECT COUNT(*) FROM porcoes')[0].values[0][0]).toBe(1)
})

test('rodar duas vezes não duplica e não toca as do usuário', async () => {
  const { b, id } = await comCafe()
  await adicionarPorcao(b, id, 'Minha caneca', 250)
  const lista = { 'Café, infusão 10%': [['Xícara (180 ml)', 180]] as [string, number][] }
  sincronizarPorcoesLista(b, lista)
  sincronizarPorcoesLista(b, lista)
  expect(porcoesDoAlimento(b, id).map((p) => p.nome)).toEqual(['Xícara (180 ml)', 'Minha caneca'])
})

test('todo nome de PORCOES_LISTA existe na TACO e toda porção tem gramas > 0', () => {
  expect(Object.keys(PORCOES_LISTA).filter((n) => !taco.has(n))).toEqual([])
  expect(Object.values(PORCOES_LISTA).flat().every(([, g]) => g > 0)).toBe(true)
})
