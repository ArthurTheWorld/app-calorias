/** Ficha de treino: o usuário monta e edita pelo app (tabelas `divisoes` e `exercicios_ficha`). */
export interface ExercicioFicha { id: number; nome: string; series: number; reps: string; obs: string | null }
export interface Divisao { id: number; nome: string; titulo: string | null; exercicios: ExercicioFicha[] }

/** Dados de um exercício como o usuário digita no editor. */
export interface DadosExercicio { nome: string; series: number; reps: string; obs: string | null }
