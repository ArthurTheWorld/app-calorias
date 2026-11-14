import { expect, test } from 'vitest'
import { abrirBanco, carregarSql, consultar } from './banco'
import { addRefeicao, criarAlimento, refeicoesDoDia } from './repos'

/** Esquema exato da v1 (antes da Madrugada). */
const SCHEMA_V1 = `
CREATE TABLE perfil (id INTEGER PRIMARY KEY CHECK (id = 1), altura_cm REAL NOT NULL, peso_kg REAL NOT NULL,
  idade INTEGER NOT NULL, sexo TEXT NOT NULL CHECK (sexo IN ('M','F')), deficit_meta REAL NOT NULL);
CREATE TABLE alimentos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, nome_busca TEXT NOT NULL,
  kcal_100g REAL NOT NULL, proteina_g REAL NOT NULL DEFAULT 0, carbo_g REAL NOT NULL DEFAULT 0,
  gordura_g REAL NOT NULL DEFAULT 0, origem TEXT NOT NULL CHECK (origem IN ('TACO','custom')));
CREATE TABLE refeicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cafe','almoco','jantar','lanche')),
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
  gramas REAL NOT NULL CHECK (gramas > 0),
  kcal REAL NOT NULL
);
CREATE INDEX idx_refeicoes_data ON refeicoes(data);
CREATE TABLE treinos (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, tipo TEXT NOT NULL,
  duracao_min REAL NOT NULL, kcal REAL NOT NULL);
CREATE INDEX idx_treinos_data ON treinos(data);
`

async function bancoV1(): Promise<Uint8Array> {
  const SQL = await carregarSql()
  const db = new SQL.Database()
  db.exec(SCHEMA_V1)
  db.run(`INSERT INTO alimentos (nome, nome_busca, kcal_100g, origem) VALUES ('Arroz', 'arroz', 128, 'TACO')`)
  for (const [i, tipo] of ['cafe', 'almoco', 'jantar', 'lanche'].entries()) {
    db.run('INSERT INTO refeicoes (data, tipo, alimento_id, gramas, kcal) VALUES (?, ?, 1, ?, ?)',
      ['2026-11-13', tipo, 100 + i, 128 + i])
  }
  return db.export()
}

const versao = (b: Awaited<ReturnType<typeof abrirBanco>>) =>
  consultar<{ user_version: number }>(b, 'PRAGMA user_version')[0].user_version

test('banco v1 migra sem perder registros e aceita madrugada', async () => {
  const b = await abrirBanco(await bancoV1())
  const rs = refeicoesDoDia(b, '2026-11-13')
  expect(rs.map((r) => [r.id, r.tipo, r.gramas, r.kcal])).toEqual([
    [1, 'cafe', 100, 128], [2, 'almoco', 101, 129], [3, 'jantar', 102, 130], [4, 'lanche', 103, 131],
  ])
  await addRefeicao(b, { data: '2026-11-13', tipo: 'madrugada', alimentoId: 1, gramas: 50 })
  expect(refeicoesDoDia(b, '2026-11-13')).toHaveLength(5)
  expect(versao(b)).toBe(2)

  const b2 = await abrirBanco(b.exportar())
  expect(refeicoesDoDia(b2, '2026-11-13')).toHaveLength(5)
  expect(versao(b2)).toBe(2)
})

test('banco novo aceita madrugada e recusa tipo inválido', async () => {
  const b = await abrirBanco()
  expect(versao(b)).toBe(2)
  const id = await criarAlimento(b, { nome: 'X', kcal100g: 100, proteinaG: 0, carboG: 0, gorduraG: 0, origem: 'custom' })
  await addRefeicao(b, { data: '2026-11-13', tipo: 'madrugada', alimentoId: id, gramas: 50 })
  expect(() => b.db.run(
    `INSERT INTO refeicoes (data, tipo, alimento_id, gramas, kcal) VALUES ('2026-11-13', 'ceia', ?, 1, 1)`, [id],
  )).toThrow()
})

test('migração não reaproveita ids de refeições apagadas', async () => {
  const SQL = await carregarSql()
  const db = new SQL.Database(await bancoV1())
  db.run('DELETE FROM refeicoes WHERE id IN (3, 4)')
  const b = await abrirBanco(db.export())
  await addRefeicao(b, { data: '2026-11-13', tipo: 'madrugada', alimentoId: 1, gramas: 50 })
  expect(Math.max(...refeicoesDoDia(b, '2026-11-13').map((r) => r.id))).toBe(5)
})
