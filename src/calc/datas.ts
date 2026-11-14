import type { TipoRefeicao } from '../refeicoes'

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

/** Hora em que o dia do app vira: antes dela, "hoje" ainda é o dia anterior. */
export const VIRADA_HORA = 5

/** "Hoje" do app: o dia só vira às 05:00. */
export function hojeApp(agora: Date = new Date()): string {
  return hojeLocal(new Date(agora.getTime() - VIRADA_HORA * 3600_000))
}

/**
 * Dia em que uma refeição é salva. Madrugada registrada de manhã (05:00–11:59),
 * estando no hoje do app, vai para o dia anterior.
 */
export function dataParaRefeicao(tipo: TipoRefeicao, dataTela: string, agora: Date = new Date()): string {
  const h = agora.getHours()
  if (tipo === 'madrugada' && dataTela === hojeApp(agora) && h >= VIRADA_HORA && h < 12) {
    return somarDias(dataTela, -1)
  }
  return dataTela
}

const utc = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

/** Dias corridos de `de` até `ate`. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / 86_400_000)
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function nomeDiaSemana(data: string): string {
  return SEMANA[new Date(utc(data)).getUTCDay()]
}
