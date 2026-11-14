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
  /** Quantidade e nome da porção quando registrada por porção; null quando em gramas. */
  qtd: number | null
  porcao: string | null
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
export function buscarAlimentos(b: Banco, termo: string, limite = 20): Alimento[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return []
  const noNome = palavras.map(() => 'a.nome_busca LIKE ?').join(' AND ')
  const noApelido = palavras.map(() => 'ap.termo_busca LIKE ?').join(' AND ')
  const padroes = palavras.map((p) => `%${p}%`)
  const exato = termoBusca(termo)
  // via (menor = melhor): 0 apelido do usuário igual ao termo, 1 do usuário que contém o termo,
  // 2 da lista igual ao termo, 3 da lista que contém; NULL = achado só pelo nome.
  // Ordem: via, apelido mais curto, alimentos próprios, nomes mais curtos.
  return consultar<Alimento>(
    b,
    `SELECT id, nome, kcal100g, proteinaG, carboG, gorduraG, origem FROM (
       SELECT a.id, a.nome, a.kcal_100g AS kcal100g, a.proteina_g AS proteinaG, a.carbo_g AS carboG,
              a.gordura_g AS gorduraG, a.origem,
              (${noNome}) AS pelo_nome,
              (SELECT MIN((CASE ap.origem WHEN 'usuario' THEN 0 ELSE 2 END) + (ap.termo_busca <> ?))
                 FROM apelidos ap WHERE ap.alimento_id = a.id AND ${noApelido}) AS via,
              (SELECT MIN(length(ap.termo_busca))
                 FROM apelidos ap WHERE ap.alimento_id = a.id AND ${noApelido}) AS tam_apelido
       FROM alimentos a)
     WHERE pelo_nome OR via IS NOT NULL
     ORDER BY via IS NULL, via, tam_apelido, origem = 'TACO', length(nome) LIMIT ?`,
    [...padroes, exato, ...padroes, ...padroes, limite],
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
  r: { data: string; tipo: TipoRefeicao; alimentoId: number; gramas: number; qtd?: number; porcao?: string },
): Promise<void> {
  b.db.run(
    `INSERT INTO refeicoes (data, tipo, alimento_id, gramas, kcal, qtd, porcao)
     SELECT ?, ?, id, ?, kcal_100g * ? / 100.0, ?, ? FROM alimentos WHERE id = ?`,
    [r.data, r.tipo, r.gramas, r.gramas, r.qtd ?? null, r.porcao ?? null, r.alimentoId],
  )
  await b.salvar()
}

export function refeicoesDoDia(b: Banco, data: string): RefeicaoView[] {
  return consultar<RefeicaoView>(
    b,
    `SELECT r.id, r.data, r.tipo, r.alimento_id AS alimentoId, a.nome, r.gramas, r.kcal, r.qtd, r.porcao
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

// ---- porções
export interface Porcao { id: number; alimentoId: number; nome: string; gramas: number; origem: 'lista' | 'usuario' }

const SELECT_PORCAO = 'SELECT p.id, p.alimento_id AS alimentoId, p.nome, p.gramas, p.origem FROM porcoes p'

/** Porções de um alimento: as da lista primeiro, depois as do usuário. */
export function porcoesDoAlimento(b: Banco, alimentoId: number): Porcao[] {
  return consultar<Porcao>(b, `${SELECT_PORCAO} WHERE p.alimento_id = ? ORDER BY p.origem = 'usuario', p.id`, [alimentoId])
}

/** Porção criada pelo usuário; devolve o id. Mesmo nome no mesmo alimento atualiza os gramas. */
export async function adicionarPorcao(b: Banco, alimentoId: number, nome: string, gramas: number): Promise<number> {
  const n = nome.trim().replace(/\s+/g, ' ')
  b.db.run(
    `INSERT INTO porcoes (alimento_id, nome, gramas, origem) VALUES (?, ?, ?, 'usuario')
     ON CONFLICT(alimento_id, nome, origem) DO UPDATE SET gramas = excluded.gramas`,
    [alimentoId, n, gramas],
  )
  const [{ id }] = consultar<{ id: number }>(
    b, `SELECT id FROM porcoes WHERE alimento_id = ? AND nome = ? AND origem = 'usuario'`, [alimentoId, n],
  )
  await b.salvar()
  return id
}

export function porcoesDoUsuario(b: Banco): (Porcao & { nomeAlimento: string })[] {
  return consultar<Porcao & { nomeAlimento: string }>(
    b,
    `SELECT p.id, p.alimento_id AS alimentoId, p.nome, p.gramas, p.origem, a.nome AS nomeAlimento
     FROM porcoes p JOIN alimentos a ON a.id = p.alimento_id
     WHERE p.origem = 'usuario' ORDER BY a.nome, p.nome`,
  )
}

export async function removerPorcao(b: Banco, id: number): Promise<void> {
  b.db.run(`DELETE FROM porcoes WHERE id = ? AND origem = 'usuario'`, [id])
  await b.salvar()
}

/** Como o alimento foi registrado da última vez (maior id), ou null se nunca foi. */
export function ultimoUso(b: Banco, alimentoId: number): { porcao: string | null; qtd: number | null; gramas: number } | null {
  return consultar<{ porcao: string | null; qtd: number | null; gramas: number }>(
    b, 'SELECT porcao, qtd, gramas FROM refeicoes WHERE alimento_id = ? ORDER BY id DESC LIMIT 1', [alimentoId],
  )[0] ?? null
}

// ---- pesos
export interface RegistroPeso { id: number; data: string; pesoKg: number }

export function pesosRegistrados(b: Banco): RegistroPeso[] {
  return consultar<RegistroPeso>(b, 'SELECT id, data, peso_kg AS pesoKg FROM pesos ORDER BY data')
}

/** Mantém perfil.peso_kg igual ao registro mais recente. */
function sincronizarPesoDoPerfil(b: Banco): void {
  b.db.run('UPDATE perfil SET peso_kg = (SELECT peso_kg FROM pesos ORDER BY data DESC LIMIT 1) WHERE EXISTS (SELECT 1 FROM pesos)')
}

/** Registra o peso de um dia; registrar de novo no mesmo dia substitui. */
export async function registrarPeso(b: Banco, data: string, pesoKg: number): Promise<void> {
  b.db.run(
    'INSERT INTO pesos (data, peso_kg) VALUES (?, ?) ON CONFLICT(data) DO UPDATE SET peso_kg = excluded.peso_kg',
    [data, pesoKg],
  )
  sincronizarPesoDoPerfil(b)
  await b.salvar()
}

/** Apaga um registro. O último restante não pode ser apagado (devolve false). */
export async function removerPeso(b: Banco, id: number): Promise<boolean> {
  const [{ n }] = consultar<{ n: number }>(b, 'SELECT COUNT(*) AS n FROM pesos')
  if (n <= 1) return false
  b.db.run('DELETE FROM pesos WHERE id = ?', [id])
  sincronizarPesoDoPerfil(b)
  await b.salvar()
  return true
}
