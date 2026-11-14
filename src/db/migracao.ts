import type { Database } from 'sql.js'
import { hojeLocal } from '../calc/datas'
import { TIPOS_REFEICAO } from '../refeicoes'

export const VERSAO_BANCO = 4

const CHECK_TIPOS = TIPOS_REFEICAO.map((t) => `'${t}'`).join(',')

/**
 * Leva o banco para a versão atual.
 * v3 → v4: a tabela `pesos` vem do SCHEMA; se estiver vazia e houver perfil, o peso do perfil vira o
 * primeiro registro, na data do primeiro dia registrado (assim os dias antigos mantêm o cálculo).
 * v2 → v3: a tabela `apelidos` vem do SCHEMA (CREATE IF NOT EXISTS).
 * v1 → v2: a tabela `refeicoes` é reconstruída
 * para aceitar 'madrugada' (SQLite não altera CHECK). Roda numa transação.
 */
export function migrar(db: Database): void {
  const versao = db.exec('PRAGMA user_version')[0].values[0][0] as number
  if (versao >= VERSAO_BANCO) return

  const sql = db.exec(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'refeicoes'`)[0]
    ?.values[0][0] as string | undefined
  const precisaRecriar = sql !== undefined && !sql.includes("'madrugada'")

  db.run('BEGIN')
  try {
    if (precisaRecriar) {
      // Guarda o contador do AUTOINCREMENT: o DROP o apagaria e ids de refeições apagadas voltariam a ser usados.
      const seq = (db.exec(`SELECT seq FROM sqlite_sequence WHERE name = 'refeicoes'`)[0]?.values[0][0] as number | undefined) ?? 0
      db.run(`CREATE TABLE refeicoes_nova (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN (${CHECK_TIPOS})),
        alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
        gramas REAL NOT NULL CHECK (gramas > 0),
        kcal REAL NOT NULL
      )`)
      db.run(`INSERT INTO refeicoes_nova (id, data, tipo, alimento_id, gramas, kcal)
              SELECT id, data, tipo, alimento_id, gramas, kcal FROM refeicoes`)
      db.run('DROP TABLE refeicoes')
      db.run('ALTER TABLE refeicoes_nova RENAME TO refeicoes')
      db.run('CREATE INDEX IF NOT EXISTS idx_refeicoes_data ON refeicoes(data)')
      db.run(`UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'refeicoes'`, [seq])
      db.run(`INSERT INTO sqlite_sequence (name, seq) SELECT 'refeicoes', ? WHERE ? > 0
              AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'refeicoes')`, [seq, seq])
    }
    if (versao < 4) {
      const primeiro = (db.exec(`SELECT MIN(data) FROM (SELECT data FROM refeicoes UNION SELECT data FROM treinos)`)[0]
        ?.values[0][0] as string | null | undefined) ?? hojeLocal()
      db.run(
        `INSERT INTO pesos (data, peso_kg) SELECT ?, peso_kg FROM perfil
         WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM pesos)`,
        [primeiro],
      )
    }
    db.run(`PRAGMA user_version = ${VERSAO_BANCO}`)
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
}
