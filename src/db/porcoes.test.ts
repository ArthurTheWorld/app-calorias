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
