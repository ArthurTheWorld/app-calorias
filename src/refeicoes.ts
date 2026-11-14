export const TIPOS_REFEICAO = ['cafe', 'almoco', 'lanche', 'jantar', 'madrugada'] as const

export type TipoRefeicao = (typeof TIPOS_REFEICAO)[number]

export const NOMES_REFEICAO: Record<TipoRefeicao, string> = {
  cafe: 'Café da manhã',
  almoco: 'Almoço',
  lanche: 'Lanche da tarde',
  jantar: 'Jantar',
  madrugada: 'Madrugada',
}
