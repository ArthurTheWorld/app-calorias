import { consultar, type Banco } from './banco'
import { inserirAlimentoSemSalvar } from './repos'
import type { AlimentoTaco } from './taco'

export { normalizarTaco, type AlimentoTaco, type ItemTacoBruto } from './taco'

/** Insere a TACO se ainda não estiver no banco. Retorna quantos inseriu (não persiste: chame b.salvar()). */
export function semearTaco(b: Banco, itens: AlimentoTaco[]): number {
  const [{ n }] = consultar<{ n: number }>(b, "SELECT COUNT(*) AS n FROM alimentos WHERE origem = 'TACO'")
  if (n > 0) return 0
  b.db.run('BEGIN')
  for (const a of itens) inserirAlimentoSemSalvar(b, { ...a, origem: 'TACO' })
  b.db.run('COMMIT')
  return itens.length
}
