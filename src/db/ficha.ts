import { consultar, type Banco } from './banco'
import { normalizar } from './repos'
import type { DadosExercicio, Divisao, ExercicioFicha } from '../treino/ficha'

/**
 * Ficha de treino editada pelo usuário. O histórico de cargas (`exercicios_feitos`) é por nome:
 * remover não o apaga; renomear leva o histórico junto.
 * Exclusões são explícitas (não dependem de PRAGMA foreign_keys).
 */

const chave = (s: string) => normalizar(s).trim().replace(/\s+/g, ' ')
const limpo = (s: string | null) => {
  const t = (s ?? '').trim()
  return t === '' ? null : t
}

export function lerFicha(b: Banco): Divisao[] {
  const divisoes = consultar<{ id: number; nome: string; titulo: string | null }>(
    b, 'SELECT id, nome, titulo FROM divisoes ORDER BY ordem, id',
  )
  const exercicios = consultar<ExercicioFicha & { divisaoId: number }>(
    b, 'SELECT id, divisao_id AS divisaoId, nome, series, reps, obs FROM exercicios_ficha ORDER BY ordem, id',
  )
  return divisoes.map((d) => ({
    ...d,
    exercicios: exercicios.filter((e) => e.divisaoId === d.id).map(({ divisaoId: _, ...e }) => e),
  }))
}

/** Cria a divisão com a próxima letra livre (A, B, C…). Devolve o id. */
export async function adicionarDivisao(b: Banco): Promise<number> {
  const usados = new Set(consultar<{ nome: string }>(b, 'SELECT nome FROM divisoes').map((d) => chave(d.nome)))
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  let nome = letras.find((l) => !usados.has(chave(l)))
  for (let n = 1; !nome; n++) if (!usados.has(chave(`Divisão ${n}`))) nome = `Divisão ${n}`
  b.db.run('INSERT INTO divisoes (nome, ordem) VALUES (?, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM divisoes))', [nome])
  const id = b.db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number
  await b.salvar()
  return id
}

/** Renomeia a divisão (nome único e não vazio) e atualiza o histórico. Falso se recusado. */
export async function editarDivisao(b: Banco, id: number, d: { nome: string; titulo: string | null }): Promise<boolean> {
  const nome = d.nome.trim()
  if (!nome) return false
  const outras = consultar<{ nome: string }>(b, 'SELECT nome FROM divisoes WHERE id <> ?', [id])
  if (outras.some((o) => chave(o.nome) === chave(nome))) return false
  const antigo = consultar<{ nome: string }>(b, 'SELECT nome FROM divisoes WHERE id = ?', [id])[0]?.nome
  if (antigo === undefined) return false
  b.db.run('BEGIN')
  try {
    b.db.run('UPDATE divisoes SET nome = ?, titulo = ? WHERE id = ?', [nome, limpo(d.titulo), id])
    if (antigo !== nome) b.db.run('UPDATE exercicios_feitos SET divisao = ? WHERE divisao = ?', [nome, antigo])
    b.db.run('COMMIT')
  } catch (e) {
    b.db.run('ROLLBACK')
    throw e
  }
  await b.salvar()
  return true
}

export async function removerDivisao(b: Banco, id: number): Promise<void> {
  b.db.run('DELETE FROM exercicios_ficha WHERE divisao_id = ?', [id])
  b.db.run('DELETE FROM divisoes WHERE id = ?', [id])
  await b.salvar()
}

/** Normaliza e valida; null se inválido ou se o nome já existe na divisão (fora `ignorarId`). */
function validar(b: Banco, divisaoId: number, e: DadosExercicio, ignorarId: number | null): DadosExercicio | null {
  const nome = e.nome.trim().replace(/\s+/g, ' ')
  const reps = e.reps.trim()
  if (!nome || !reps || !Number.isInteger(e.series) || e.series < 1 || e.series > 20) return null
  const irmaos = consultar<{ id: number; nome: string }>(b, 'SELECT id, nome FROM exercicios_ficha WHERE divisao_id = ?', [divisaoId])
  if (irmaos.some((i) => i.id !== ignorarId && chave(i.nome) === chave(nome))) return null
  return { nome, series: e.series, reps, obs: limpo(e.obs) }
}

export async function adicionarExercicio(b: Banco, divisaoId: number, e: DadosExercicio): Promise<boolean> {
  const v = validar(b, divisaoId, e, null)
  if (!v) return false
  b.db.run(
    `INSERT INTO exercicios_ficha (divisao_id, nome, series, reps, obs, ordem)
     VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM exercicios_ficha WHERE divisao_id = ?))`,
    [divisaoId, v.nome, v.series, v.reps, v.obs, divisaoId],
  )
  await b.salvar()
  return true
}

/** Edita o exercício; mudar o nome leva o histórico de cargas junto. Falso se recusado. */
export async function editarExercicio(b: Banco, id: number, e: DadosExercicio): Promise<boolean> {
  const atual = consultar<{ divisaoId: number; nome: string }>(
    b, 'SELECT divisao_id AS divisaoId, nome FROM exercicios_ficha WHERE id = ?', [id],
  )[0]
  if (!atual) return false
  const v = validar(b, atual.divisaoId, e, id)
  if (!v) return false
  b.db.run('BEGIN')
  try {
    b.db.run('UPDATE exercicios_ficha SET nome = ?, series = ?, reps = ?, obs = ? WHERE id = ?', [v.nome, v.series, v.reps, v.obs, id])
    // OR IGNORE: um dia que já tem registro com o nome novo fica como está.
    if (atual.nome !== v.nome) b.db.run('UPDATE OR IGNORE exercicios_feitos SET exercicio = ? WHERE exercicio = ?', [v.nome, atual.nome])
    b.db.run('COMMIT')
  } catch (err) {
    b.db.run('ROLLBACK')
    throw err
  }
  await b.salvar()
  return true
}

export async function removerExercicio(b: Banco, id: number): Promise<void> {
  b.db.run('DELETE FROM exercicios_ficha WHERE id = ?', [id])
  await b.salvar()
}

/** Troca de lugar com o vizinho de cima (-1) ou de baixo (1). Nas pontas, nada muda. */
export async function moverExercicio(b: Banco, id: number, delta: -1 | 1): Promise<void> {
  const d = consultar<{ divisaoId: number }>(b, 'SELECT divisao_id AS divisaoId FROM exercicios_ficha WHERE id = ?', [id])[0]
  if (!d) return
  const lista = consultar<{ id: number }>(b, 'SELECT id FROM exercicios_ficha WHERE divisao_id = ? ORDER BY ordem, id', [d.divisaoId])
  const i = lista.findIndex((e) => e.id === id)
  const j = i + delta
  if (j < 0 || j >= lista.length) return
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  b.db.run('BEGIN')
  lista.forEach((e, k) => b.db.run('UPDATE exercicios_ficha SET ordem = ? WHERE id = ?', [k + 1, e.id]))
  b.db.run('COMMIT')
  await b.salvar()
}
