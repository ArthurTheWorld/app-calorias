// Funções puras (sem dependências) — usadas pelo app e pelo script gerar-taco.
export interface AlimentoTaco {
  nome: string
  kcal100g: number
  proteinaG: number
  carboG: number
  gorduraG: number
}

type Valor = number | string | undefined
export interface ItemTacoBruto {
  description: string
  energy_kcal: Valor
  protein_g: Valor
  carbohydrate_g: Valor
  lipid_g: Valor
}

/** "Tr" (traço) e vazio viram 0; "NA" vira null. */
function num(v: Valor): number | null {
  if (typeof v === 'number') return v
  if (v === 'NA' || v === '*') return null
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && String(v ?? '').trim() !== '' && v !== 'Tr' ? n : 0
}
const r1 = (n: number) => Math.round(n * 10) / 10

export function normalizarTaco(itens: ItemTacoBruto[]): AlimentoTaco[] {
  const out: AlimentoTaco[] = []
  for (const i of itens) {
    const kcal = num(i.energy_kcal)
    if (kcal === null || !i.description) continue
    out.push({
      nome: i.description.trim(),
      kcal100g: Math.round(kcal),
      proteinaG: r1(num(i.protein_g) ?? 0),
      carboG: r1(num(i.carbohydrate_g) ?? 0),
      gorduraG: r1(num(i.lipid_g) ?? 0),
    })
  }
  return out
}
