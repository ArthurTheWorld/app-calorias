import type { DiaJogo } from '../db/repos'
import { somarDias } from './datas'
import { streak, type DiaResumo } from './historico'
import { registrado } from './jogo'

export type NomeIcone =
  | 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'madrugada'
  | 'chama' | 'calendario' | 'trofeu' | 'haltere' | 'estrela' | 'hoje' | 'perfil'

export interface Conquista {
  id: string
  nome: string
  descricao: string
  icone: NomeIcone
  progresso: number
  meta: number
  desbloqueada: boolean
}

/** Maior sequência de dias registrados consecutivos. */
function maiorSequenciaRegistro(dias: DiaJogo[]): number {
  let maior = 0
  let corrida = 0
  let anterior: string | null = null
  for (const d of dias.filter(registrado)) {
    corrida = anterior !== null && somarDias(anterior, 1) === d.data ? corrida + 1 : 1
    maior = Math.max(maior, corrida)
    anterior = d.data
  }
  return maior
}

const BASICOS = ['cafe', 'almoco', 'lanche', 'jantar'] as const

function criar(id: string, nome: string, descricao: string, icone: NomeIcone, valor: number, meta: number): Conquista {
  const progresso = Math.min(valor, meta)
  return { id, nome, descricao, icone, progresso, meta, desbloqueada: progresso >= meta }
}

/** As 9 conquistas, calculadas dos registros. Déficit só conta dias anteriores a hoje. */
export function conquistas(dias: DiaJogo[], resumos: DiaResumo[], hoje: string): Conquista[] {
  const registrados = dias.filter(registrado).length
  const recordeDeficit = streak(resumos.filter((r) => r.data < hoje), hoje).recorde
  const treinos = dias.reduce((s, d) => s + d.qtdTreinos, 0)
  const diaCompleto = Math.max(0, ...dias.map((d) => BASICOS.filter((t) => d.kcalPorTipo[t] !== undefined).length))
  const seqRegistro = maiorSequenciaRegistro(dias)

  return [
    criar('primeiro-registro', 'Primeiro registro', 'Registrou a primeira refeição', 'estrela', registrados, 1),
    criar('dias-7', '7 dias', '7 dias registrados', 'calendario', registrados, 7),
    criar('dias-30', '30 dias', '30 dias registrados', 'calendario', registrados, 30),
    criar('semana-completa', 'Semana completa', '7 dias seguidos registrando', 'calendario', seqRegistro, 7),
    criar('deficit-3', '3 em déficit', '3 dias seguidos abaixo do gasto', 'chama', recordeDeficit, 3),
    criar('deficit-7', '7 em déficit', '7 dias seguidos abaixo do gasto', 'chama', recordeDeficit, 7),
    criar('primeiro-treino', 'Primeiro treino', 'Registrou o primeiro treino', 'haltere', treinos, 1),
    criar('treinos-10', '10 treinos', '10 treinos registrados', 'haltere', treinos, 10),
    criar('dia-completo', 'Dia completo', 'Café, almoço, lanche e jantar no mesmo dia', 'trofeu', diaCompleto, 4),
  ]
}

/** A bloqueada mais perto de sair (empate: a que vem primeiro). */
export function proximaConquista(cs: Conquista[]): Conquista | null {
  let melhor: Conquista | null = null
  for (const c of cs) {
    if (c.desbloqueada) continue
    if (!melhor || c.progresso / c.meta > melhor.progresso / melhor.meta) melhor = c
  }
  return melhor
}

/** "falta 1 dia registrado" / "faltam 3 dias registrados" */
const falta = (n: number, um: string, varios: string) => `falta${n === 1 ? '' : 'm'} ${n} ${n === 1 ? um : varios}`

/** O que falta para a conquista, em tom neutro. */
export function textoFalta(c: Conquista): string {
  const f = c.meta - c.progresso
  switch (c.id) {
    case 'primeiro-registro': return 'falta registrar a primeira refeição'
    case 'dias-7':
    case 'dias-30': return falta(f, 'dia registrado', 'dias registrados')
    case 'semana-completa': return `${falta(f, 'dia seguido', 'dias seguidos')} registrando`
    case 'deficit-3':
    case 'deficit-7': return `${falta(f, 'dia seguido', 'dias seguidos')} abaixo do gasto`
    case 'primeiro-treino': return 'falta registrar o primeiro treino'
    case 'treinos-10': return falta(f, 'treino', 'treinos')
    case 'dia-completo': return `${falta(f, 'refeição', 'refeições')} no mesmo dia`
    default: return falta(f, 'passo', 'passos')
  }
}
