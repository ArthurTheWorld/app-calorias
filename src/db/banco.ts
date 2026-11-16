import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { get, set, update } from 'idb-keyval'
import { SCHEMA } from './schema.sql'
import { migrar } from './migracao'

const CHAVE_IDB = 'banco'
const CHAVE_SEQ = 'seq-local'

/** Quantas vezes o banco foi gravado neste aparelho (a sincronização compara com o último enviado). */
export async function lerSeqLocal(): Promise<number> {
  return (await get<number>(CHAVE_SEQ)) ?? 0
}

/** Grava os bytes do banco no aparelho e soma 1 no contador de gravações. */
export async function gravarBytes(dados: Uint8Array): Promise<void> {
  await set(CHAVE_IDB, dados)
  await update<number>(CHAVE_SEQ, (n) => (n ?? 0) + 1)
}
let sqlPromise: Promise<SqlJsStatic> | null = null

export function carregarSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const noNode = import.meta.env.MODE === 'test'
    sqlPromise = noNode
      ? initSqlJs()
      : import('sql.js/dist/sql-wasm.wasm?url').then((m) =>
          initSqlJs({ locateFile: () => m.default }),
        )
  }
  return sqlPromise
}

export interface Banco {
  db: Database
  /** Persiste o banco inteiro no IndexedDB do aparelho. */
  salvar(): Promise<void>
  /** Bytes do arquivo .sqlite. */
  exportar(): Uint8Array
}

export async function abrirBanco(dados?: Uint8Array): Promise<Banco> {
  const SQL = await carregarSql()
  const db = new SQL.Database(dados)
  db.run('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  migrar(db)
  return {
    db,
    salvar: () => gravarBytes(db.export()),
    exportar: () => db.export(),
  }
}

/** Abre o banco salvo no aparelho (ou um novo, se não houver). */
export async function carregarBancoSalvo(): Promise<Banco> {
  const dados = await get<Uint8Array>(CHAVE_IDB)
  return abrirBanco(dados)
}

/** Linhas de uma consulta como objetos. */
export function consultar<T>(b: Banco, sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = b.db.prepare(sql)
  stmt.bind(params)
  const out: T[] = []
  while (stmt.step()) out.push(stmt.getAsObject() as T)
  stmt.free()
  return out
}
