import type { Banco } from './banco'

type Lista = Record<string, [nome: string, gramas: number][]>

const UNIDADE_OVO: [string, number][] = [['Unidade', 50]]
const FATIA_FORMA: [string, number][] = [['Fatia', 25]]
const ARROZ: [string, number][] = [['Colher de servir', 45], ['Colher de sopa', 25]]
const FATIA_FINA: [string, number][] = [['Fatia', 15]]
const COLHER_CHA_GORDURA: [string, number][] = [['Colher de chá', 5]]
const REFRI: [string, number][] = [['Lata (350 ml)', 350], ['Copo (200 ml)', 200]]

/**
 * Porções caseiras para itens da TACO. Chave: nome EXATO da TACO; valor: [nome da porção, gramas].
 * Bebidas: 1 ml = 1 g, com o volume no nome. Valores médios de tabelas de medidas caseiras.
 * Sincronizada a cada abertura do app; as porções do usuário nunca são tocadas.
 */
export const PORCOES_LISTA: Lista = {
  'Café, infusão 10%': [['Xícara (180 ml)', 180], ['Cafezinho (50 ml)', 50]],
  'Ovo, de galinha, inteiro, cozido/10minutos': UNIDADE_OVO,
  'Ovo, de galinha, inteiro, frito': UNIDADE_OVO,
  'Ovo, de galinha, inteiro, cru': UNIDADE_OVO,
  'Pão, trigo, francês': [['Unidade', 50]],
  'Pão, de queijo, assado': [['Unidade', 20]],
  'Pão, trigo, forma, integral': FATIA_FORMA,
  'Pão, aveia, forma': FATIA_FORMA,
  'Pão, milho, forma': FATIA_FORMA,
  'Pão, glúten, forma': FATIA_FORMA,
  'Biscoito, salgado, cream cracker': [['Unidade', 6]],
  'Arroz, tipo 1, cozido': ARROZ,
  'Arroz, integral, cozido': ARROZ,
  'Feijão, carioca, cozido': [['Concha', 90]],
  'Feijão, preto, cozido': [['Concha', 90]],
  'Carne, bovina, acém, moído, cozido': [['Colher de sopa', 25]],
  'Frango, peito, sem pele, grelhado': [['Filé', 100]],
  'Carne, bovina, patinho, sem gordura, grelhado': [['Bife', 100]],
  'Queijo, mozarela': FATIA_FINA,
  'Queijo, prato': FATIA_FINA,
  'Presunto, sem capa de gordura': FATIA_FINA,
  'Mortadela': FATIA_FINA,
  'Queijo, minas, frescal': [['Fatia', 30]],
  'Manteiga, com sal': COLHER_CHA_GORDURA,
  'Margarina, com óleo hidrogenado, com sal (65% de lipídeos)': COLHER_CHA_GORDURA,
  'Azeite, de oliva, extra virgem': [['Colher de sopa', 8]],
  'Açúcar, refinado': [['Colher de chá', 5], ['Colher de sopa', 12]],
  'Mel, de abelha': [['Colher de sopa', 20]],
  'Achocolatado, pó': [['Colher de sopa', 15]],
  'Aveia, flocos, crua': [['Colher de sopa', 15]],
  'Iogurte, natural': [['Pote', 170]],
  'Banana, prata, crua': [['Unidade', 65]],
  'Maçã, Fuji, com casca, crua': [['Unidade', 130]],
  'Laranja, pêra, crua': [['Unidade', 140]],
  'Laranja, pêra, suco': [['Copo (200 ml)', 200]],
  'Refrigerante, tipo cola': REFRI,
  'Refrigerante, tipo guaraná': REFRI,
  'Cerveja, pilsen 2': [['Lata (350 ml)', 350]],
  'Pastel, de carne, frito': [['Unidade', 80]],
  'Coxinha de frango, frita': [['Unidade', 80]],
}

/**
 * Regrava as porções de origem 'lista' a partir da lista atual (não persiste: quem chama salva se quiser).
 * Nomes que não existirem na TACO do banco são ignorados.
 */
export function sincronizarPorcoesLista(b: Banco, lista: Lista = PORCOES_LISTA): void {
  b.db.run('BEGIN')
  try {
    b.db.run("DELETE FROM porcoes WHERE origem = 'lista'")
    const achar = b.db.prepare("SELECT id FROM alimentos WHERE nome = ? AND origem = 'TACO' LIMIT 1")
    const inserir = b.db.prepare(
      "INSERT OR IGNORE INTO porcoes (alimento_id, nome, gramas, origem) VALUES (?, ?, ?, 'lista')",
    )
    for (const [nome, porcoes] of Object.entries(lista)) {
      achar.bind([nome])
      const id = achar.step() ? (achar.get()[0] as number) : null
      achar.reset()
      if (id === null) continue
      for (const [p, g] of porcoes) inserir.run([id, p, g])
    }
    achar.free()
    inserir.free()
    b.db.run('COMMIT')
  } catch (e) {
    b.db.run('ROLLBACK')
    throw e
  }
}
