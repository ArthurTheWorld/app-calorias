import { expect, test } from 'vitest'
import { abrirBanco } from './db/banco'
import { addRefeicao, criarAlimento } from './db/repos'
import { tabelaParaCsv, validarBancoImportado } from './exportar'

test('csv com cabeçalho, ; e aspas escapadas', async () => {
  const b = await abrirBanco()
  const id = await criarAlimento(b, { nome: 'Pão; "francês"', kcal100g: 300, proteinaG: 8, carboG: 58.6, gorduraG: 3.1, origem: 'custom' })
  await addRefeicao(b, { data: '2026-11-14', tipo: 'cafe', alimentoId: id, gramas: 50 })
  const csv = tabelaParaCsv(b, 'alimentos').split('\n')
  expect(csv[0]).toBe('id;nome;nome_busca;kcal_100g;proteina_g;carbo_g;gordura_g;origem')
  expect(csv[1]).toBe('1;"Pão; ""francês""";"pao; ""frances""";300;8;58.6;3.1;custom')
  expect(tabelaParaCsv(b, 'refeicoes').split('\n')[1]).toBe('1;2026-11-14;cafe;1;50;150')
})

test('tabela desconhecida é recusada', async () => {
  const b = await abrirBanco()
  expect(() => tabelaParaCsv(b, 'perfil; DROP TABLE x')).toThrow()
})

test('importação só aceita banco do app', async () => {
  const b = await abrirBanco()
  expect(await validarBancoImportado(b.exportar())).toBe(true)
  expect(await validarBancoImportado(new Uint8Array([1, 2, 3]))).toBe(false)
})
