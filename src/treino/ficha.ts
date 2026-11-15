export interface ExercicioFicha { nome: string; series: number; reps: string; obs?: string }
export interface Divisao { nome: string; titulo?: string; exercicios: ExercicioFicha[] }

/**
 * Ficha de treino atual, cadastrada a partir dos prints do usuário (o MFit não exporta).
 * Vazia até o próximo treino: enquanto estiver vazia, a aba Treino não mostra a ficha.
 * O histórico de cargas é por nome do exercício, então trocar a ficha não perde nada.
 */
export const FICHA: Divisao[] = []
