import type { DiaJogo } from '../db/repos'
import { NOMES_REFEICAO, TIPOS_REFEICAO, type TipoRefeicao } from '../refeicoes'
import { somarDias } from './datas'
import { streak, type DiaResumo } from './historico'
import { registrado } from './jogo'

export interface Painel {
  sequencia: number
  recorde: number
  /** Déficit médio dos últimos 7 dias fechados (positivo = abaixo do gasto). */
  media7: number | null
  ontem: number | null
  registros14: number
}

/** Números do painel. Só dias anteriores a hoje contam para resultado. */
export function painel(resumos: DiaResumo[], dias: DiaJogo[], hoje: string): Painel {
  const fechados = resumos.filter((r) => r.data < hoje).sort((a, b) => a.data.localeCompare(b.data))
  const s = streak(fechados, hoje)
  const ultimos = fechados.slice(-7)
  const ontem = fechados.find((r) => r.data === somarDias(hoje, -1))
  const inicio = somarDias(hoje, -13)
  return {
    sequencia: s.atual,
    recorde: s.recorde,
    media7: ultimos.length ? ultimos.reduce((t, r) => t + r.deficit, 0) / ultimos.length : null,
    ontem: ontem ? ontem.deficit : null,
    registros14: dias.filter((d) => registrado(d) && d.data >= inicio && d.data <= hoje).length,
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const comArtigo = (t: TipoRefeicao) => `${t === 'madrugada' ? 'a' : 'o'} ${NOMES_REFEICAO[t].toLowerCase()}`
const maiuscula = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Frase factual sobre ontem, ou null se ontem não tem registro. */
export function fechamentoOntem(dias: DiaJogo[], resumos: DiaResumo[], hoje: string): string | null {
  const dataOntem = somarDias(hoje, -1)
  const ontem = dias.find((d) => d.data === dataOntem && registrado(d))
  const r = resumos.find((x) => x.data === dataOntem)
  if (!ontem || !r) return null

  const saldo = r.deficit >= 0 ? `${fmt(r.deficit)} abaixo do gasto` : `${fmt(-r.deficit)} acima do gasto`
  const inicio = `Ontem: ${fmt(ontem.consumido)} kcal, ${saldo}.`

  // Média de cada refeição nos até 7 dias registrados anteriores em que ela aparece.
  const anteriores = dias.filter((d) => d.data < dataOntem && registrado(d)).slice(-7)
  let destaque: { tipo: TipoRefeicao; kcal: number; media: number } | null = null
  for (const t of TIPOS_REFEICAO) {
    const kcal = ontem.kcalPorTipo[t]
    if (kcal === undefined) continue
    const hist = anteriores.map((d) => d.kcalPorTipo[t]).filter((k): k is number => k !== undefined)
    if (!hist.length) continue
    const media = hist.reduce((s, k) => s + k, 0) / hist.length
    if (kcal > media && (!destaque || kcal - media > destaque.kcal - destaque.media)) destaque = { tipo: t, kcal, media }
  }
  if (destaque) {
    return `${inicio} ${maiuscula(comArtigo(destaque.tipo))} foi ${fmt(destaque.kcal)} kcal, acima da sua média de ${fmt(destaque.media)}.`
  }
  const [maior, kcal] = (Object.entries(ontem.kcalPorTipo) as [TipoRefeicao, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a))
  return `${inicio} A maior refeição foi ${comArtigo(maior)}, com ${fmt(kcal)} kcal.`
}
