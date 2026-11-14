import { carregarSql, consultar, type Banco } from './db/banco'

export const TABELAS = ['perfil', 'alimentos', 'refeicoes', 'treinos', 'apelidos', 'pesos', 'porcoes'] as const
/** Tabelas que um backup precisa ter (backups de versões antigas não têm 'apelidos' nem 'pesos'). */
export const TABELAS_OBRIGATORIAS = ['perfil', 'alimentos', 'refeicoes', 'treinos'] as const

function celula(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Tabela como CSV: separador ';', decimal com ponto, cabeçalho na 1ª linha. */
export function tabelaParaCsv(b: Banco, tabela: string): string {
  if (!(TABELAS as readonly string[]).includes(tabela)) throw new Error(`Tabela desconhecida: ${tabela}`)
  const colunas = consultar<{ name: string }>(b, `PRAGMA table_info(${tabela})`).map((c) => c.name)
  const linhas = consultar<Record<string, unknown>>(b, `SELECT * FROM ${tabela} ORDER BY 1`)
  return [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(';'))].join('\n')
}

/** Verdadeiro se os bytes são um SQLite com as tabelas do app. */
export async function validarBancoImportado(dados: Uint8Array): Promise<boolean> {
  try {
    const SQL = await carregarSql()
    const db = new SQL.Database(dados)
    const res = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")
    db.close()
    const nomes = new Set((res[0]?.values ?? []).map((v) => String(v[0])))
    return TABELAS_OBRIGATORIAS.every((t) => nomes.has(t))
  } catch {
    return false
  }
}

export function baixar(nome: string, conteudo: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
