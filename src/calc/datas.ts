const pad = (n: number) => String(n).padStart(2, '0')

/** Data local no formato YYYY-MM-DD (não usa UTC). */
export function hojeLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Converte "150,5" → 150.5; retorna null para vazio, inválido ou ≤ 0. */
export function parseGramas(txt: string): number | null {
  const limpo = txt.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null
  const n = Number(limpo)
  return n > 0 ? n : null
}

/** Soma dias a uma data YYYY-MM-DD (data local). */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return hojeLocal(new Date(a, m - 1, d + dias))
}
