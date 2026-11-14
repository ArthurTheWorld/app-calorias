import type { Perfil } from '../calc/energia'
import { consultar, type Banco } from './banco'

import type { TipoRefeicao } from '../refeicoes'
export type { TipoRefeicao }

export interface Alimento {
  id: number
  nome: string
  kcal100g: number
  proteinaG: number
  carboG: number
  gorduraG: number
  origem: 'TACO' | 'custom'
}

export interface RefeicaoView {
  id: number
  data: string
  tipo: TipoRefeicao
  alimentoId: number
  nome: string
  gramas: number
  kcal: number
}

export interface Treino {
  id: number
  data: string
  tipo: string
  duracaoMin: number
  kcal: number
}

export interface TotalDia { data: string; consumido: number; treinos: number }

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---- perfil
export function getPerfil(b: Banco): Perfil | null {
  const [r] = consultar<Record<string, number | string>>(b, 'SELECT * FROM perfil WHERE id = 1')
  if (!r) return null
  return {
    alturaCm: r.altura_cm as number,
    pesoKg: r.peso_kg as number,
    idade: r.idade as number,
    sexo: r.sexo as Perfil['sexo'],
    deficitMeta: r.deficit_meta as number,
  }
}

export async function salvarPerfil(b: Banco, p: Perfil): Promise<void> {
  b.db.run(
    `INSERT INTO perfil (id, altura_cm, peso_kg, idade, sexo, deficit_meta) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET altura_cm=excluded.altura_cm, peso_kg=excluded.peso_kg,
       idade=excluded.idade, sexo=excluded.sexo, deficit_meta=excluded.deficit_meta`,
    [p.alturaCm, p.pesoKg, p.idade, p.sexo, p.deficitMeta],
  )
  await b.salvar()
}

// ---- alimentos
const SELECT_ALIMENTO = `SELECT id, nome, kcal_100g AS kcal100g, proteina_g AS proteinaG,
  carbo_g AS carboG, gordura_g AS gorduraG, origem FROM alimentos`

export function buscarAlimentos(b: Banco, termo: string, limite = 20): Alimento[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return []
  const where = palavras.map(() => 'nome_busca LIKE ?').join(' AND ')
  // alimentos próprios primeiro, depois os nomes mais curtos (mais genéricos)
  return consultar<Alimento>(
    b,
    `${SELECT_ALIMENTO} WHERE ${where} ORDER BY origem = 'TACO', length(nome) LIMIT ?`,
    [...palavras.map((p) => `%${p}%`), limite],
  )
}

export function inserirAlimentoSemSalvar(b: Banco, a: Omit<Alimento, 'id'>): number {
  b.db.run(
    `INSERT INTO alimentos (nome, nome_busca, kcal_100g, proteina_g, carbo_g, gordura_g, origem)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [a.nome, normalizar(a.nome), a.kcal100g, a.proteinaG, a.carboG, a.gorduraG, a.origem],
  )
  return consultar<{ id: number }>(b, 'SELECT last_insert_rowid() AS id')[0].id
}

export async function criarAlimento(b: Banco, a: Omit<Alimento, 'id'>): Promise<number> {
  const id = inserirAlimentoSemSalvar(b, a)
  await b.salvar()
  return id
}

// ---- refeições
export async function addRefeicao(
  b: Banco,
  r: { data: string; tipo: TipoRefeicao; alimentoId: number; gramas: number },
): Promise<void> {
  b.db.run(
    `INSERT INTO refeicoes (data, tipo, alimento_id, gramas, kcal)
     SELECT ?, ?, id, ?, kcal_100g * ? / 100.0 FROM alimentos WHERE id = ?`,
    [r.data, r.tipo, r.gramas, r.gramas, r.alimentoId],
  )
  await b.salvar()
}

export function refeicoesDoDia(b: Banco, data: string): RefeicaoView[] {
  return consultar<RefeicaoView>(
    b,
    `SELECT r.id, r.data, r.tipo, r.alimento_id AS alimentoId, a.nome, r.gramas, r.kcal
     FROM refeicoes r JOIN alimentos a ON a.id = r.alimento_id WHERE r.data = ? ORDER BY r.id`,
    [data],
  )
}

export async function removerRefeicao(b: Banco, id: number): Promise<void> {
  b.db.run('DELETE FROM refeicoes WHERE id = ?', [id])
  await b.salvar()
}

// ---- treinos
export async function addTreino(b: Banco, t: Omit<Treino, 'id'>): Promise<void> {
  b.db.run('INSERT INTO treinos (data, tipo, duracao_min, kcal) VALUES (?, ?, ?, ?)', [
    t.data, t.tipo, t.duracaoMin, t.kcal,
  ])
  await b.salvar()
}

export function treinosDoDia(b: Banco, data: string): Treino[] {
  return consultar<Treino>(
    b,
    'SELECT id, data, tipo, duracao_min AS duracaoMin, kcal FROM treinos WHERE data = ? ORDER BY id',
    [data],
  )
}

export async function removerTreino(b: Banco, id: number): Promise<void> {
  b.db.run('DELETE FROM treinos WHERE id = ?', [id])
  await b.salvar()
}

// ---- totais
export function totaisPorDia(b: Banco, de: string, ate: string): TotalDia[] {
  return consultar<TotalDia>(
    b,
    `WITH dias AS (
       SELECT data FROM refeicoes WHERE data BETWEEN ?1 AND ?2
       UNION SELECT data FROM treinos WHERE data BETWEEN ?1 AND ?2)
     SELECT d.data,
       COALESCE((SELECT SUM(kcal) FROM refeicoes WHERE data = d.data), 0) AS consumido,
       COALESCE((SELECT SUM(kcal) FROM treinos WHERE data = d.data), 0) AS treinos
     FROM dias d ORDER BY d.data`,
    [de, ate],
  )
}

// ---- jogo
export interface DiaJogo {
  data: string
  kcalPorTipo: Partial<Record<TipoRefeicao, number>>
  consumido: number
  treinosKcal: number
  qtdTreinos: number
}

/** Todos os dias com refeição ou treino, em ordem de data. */
export function diasDoJogo(b: Banco): DiaJogo[] {
  const porData = new Map<string, DiaJogo>()
  const pegar = (data: string) => {
    let d = porData.get(data)
    if (!d) {
      d = { data, kcalPorTipo: {}, consumido: 0, treinosKcal: 0, qtdTreinos: 0 }
      porData.set(data, d)
    }
    return d
  }
  for (const r of consultar<{ data: string; tipo: TipoRefeicao; kcal: number }>(
    b, 'SELECT data, tipo, SUM(kcal) AS kcal FROM refeicoes GROUP BY data, tipo',
  )) {
    const d = pegar(r.data)
    d.kcalPorTipo[r.tipo] = r.kcal
    d.consumido += r.kcal
  }
  for (const t of consultar<{ data: string; kcal: number; qtd: number }>(
    b, 'SELECT data, SUM(kcal) AS kcal, COUNT(*) AS qtd FROM treinos GROUP BY data',
  )) {
    const d = pegar(t.data)
    d.treinosKcal = t.kcal
    d.qtdTreinos = t.qtd
  }
  return [...porData.values()].sort((a, c) => a.data.localeCompare(c.data))
}

// ---- apelidos
export interface Apelido { id: number; alimentoId: number; termo: string; nomeAlimento: string }

/** Forma de busca de um termo: sem acento, minúsculas, espaços colapsados. */
export const termoBusca = (termo: string) => normalizar(termo).trim().replace(/\s+/g, ' ')

/** Apelido ensinado pelo usuário. Repetido (mesmo alimento e mesmo termo) é ignorado. */
export async function adicionarApelido(b: Banco, alimentoId: number, termo: string): Promise<void> {
  const t = termo.trim().replace(/\s+/g, ' ')
  if (!t) return
  b.db.run(
    `INSERT OR IGNORE INTO apelidos (alimento_id, termo, termo_busca, origem) VALUES (?, ?, ?, 'usuario')`,
    [alimentoId, t, termoBusca(t)],
  )
  await b.salvar()
}

export function apelidosDoUsuario(b: Banco): Apelido[] {
  return consultar<Apelido>(
    b,
    `SELECT ap.id, ap.alimento_id AS alimentoId, ap.termo, a.nome AS nomeAlimento
     FROM apelidos ap JOIN alimentos a ON a.id = ap.alimento_id
     WHERE ap.origem = 'usuario' ORDER BY ap.termo_busca`,
  )
}

export async function removerApelido(b: Banco, id: number): Promise<void> {
  b.db.run(`DELETE FROM apelidos WHERE id = ? AND origem = 'usuario'`, [id])
  await b.salvar()
}
