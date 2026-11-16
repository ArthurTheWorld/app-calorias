/** Temas de cor: o fundo continua preto, só a cor de destaque (`--acento`) muda. */
export const TEMAS = [
  { id: 'roxo', nome: 'Roxo', acento: '#c77dff' },
  { id: 'verde', nome: 'Verde', acento: '#5cf08a' },
  { id: 'rosa', nome: 'Rosa neon', acento: '#ff4fd8' },
  { id: 'vermelho', nome: 'Vermelho', acento: '#ff5a5a' },
  { id: 'laranja', nome: 'Laranja', acento: '#ff9f43' },
] as const

export type IdTema = (typeof TEMAS)[number]['id']
const CHAVE = 'tema'

/** Tema guardado neste aparelho (roxo se não houver ou for desconhecido). */
export function temaSalvo(): IdTema {
  try {
    const id = localStorage.getItem(CHAVE)
    return TEMAS.find((t) => t.id === id)?.id ?? 'roxo'
  } catch {
    return 'roxo'
  }
}

/** Pinta o app com o tema guardado (chamado antes do primeiro desenho). */
export function aplicarTema(id: IdTema = temaSalvo()): void {
  const t = TEMAS.find((x) => x.id === id) ?? TEMAS[0]
  document.documentElement.style.setProperty('--acento', t.acento)
}

export function escolherTema(id: IdTema): void {
  try { localStorage.setItem(CHAVE, id) } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicarTema(id)
}
