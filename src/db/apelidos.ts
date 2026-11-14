import type { Banco } from './banco'
import { termoBusca } from './repos'

/**
 * Apelidos do dia a dia para itens da TACO. Chave: nome EXATO da TACO; valor: termos de busca.
 * Sincronizada a cada abertura do app; os apelidos ensinados pelo usuário nunca são tocados.
 * Itens sem versão pronta para comer na TACO (leite líquido, macarrão cozido) ficam de fora:
 * o usuário pode ensinar um apelido para um alimento que ele mesmo cadastrar.
 */
export const APELIDOS_LISTA: Record<string, string[]> = {
  'Arroz, tipo 1, cozido': ['arroz', 'arroz branco', 'arroz cozido'],
  'Arroz, integral, cozido': ['arroz integral'],
  'Feijão, carioca, cozido': ['feijão', 'feijão carioca', 'feijão cozido'],
  'Feijão, preto, cozido': ['feijão preto'],
  'Feijoada': ['feijoada'],
  'Carne, bovina, acém, moído, cozido': ['carne moída', 'moída'],
  'Carne, bovina, patinho, sem gordura, grelhado': ['bife', 'carne grelhada', 'patinho', 'bife de patinho'],
  'Carne, bovina, contra-filé, sem gordura, grelhado': ['contrafilé', 'contra filé', 'bife de contrafilé'],
  'Carne, bovina, picanha, sem gordura, grelhada': ['picanha', 'churrasco'],
  'Frango, peito, sem pele, grelhado': ['frango', 'frango grelhado', 'peito de frango', 'filé de frango'],
  'Frango, coxa, com pele, assada': ['coxa de frango', 'frango assado'],
  'Porco, bisteca, grelhada': ['bisteca', 'carne de porco'],
  'Hambúrguer, bovino, grelhado': ['hambúrguer', 'hamburguer'],
  'Ovo, de galinha, inteiro, cozido/10minutos': ['ovo', 'ovo cozido'],
  'Ovo, de galinha, inteiro, frito': ['ovo frito'],
  'Atum, conserva em óleo': ['atum', 'atum em lata'],
  'Sardinha, conserva em óleo': ['sardinha', 'sardinha em lata'],
  'Pão, trigo, francês': ['pão', 'pão francês', 'pãozinho', 'cacetinho', 'pão de sal'],
  'Pão, trigo, forma, integral': ['pão integral', 'pão de forma integral'],
  'Pão, de queijo, assado': ['pão de queijo'],
  'Biscoito, salgado, cream cracker': ['bolacha', 'cream cracker', 'biscoito salgado'],
  'Tapioca, com manteiga': ['tapioca'],
  'Cuscuz, de milho, cozido com sal': ['cuscuz'],
  'Aveia, flocos, crua': ['aveia'],
  'Batata, inglesa, cozida': ['batata', 'batata cozida'],
  'Batata, inglesa, frita': ['batata frita', 'fritas'],
  'Batata, doce, cozida': ['batata doce'],
  'Mandioca, cozida': ['mandioca', 'aipim', 'macaxeira'],
  'Mandioca, farofa, temperada': ['farofa'],
  'Café, infusão 10%': ['café', 'cafezinho', 'café preto'],
  'Iogurte, natural': ['iogurte'],
  'Queijo, mozarela': ['queijo', 'muçarela', 'mussarela', 'mozzarella'],
  'Queijo, minas, frescal': ['queijo branco', 'queijo minas'],
  'Queijo, prato': ['queijo prato'],
  'Presunto, sem capa de gordura': ['presunto'],
  'Mortadela': ['mortadela'],
  'Manteiga, com sal': ['manteiga'],
  'Margarina, com óleo hidrogenado, com sal (65% de lipídeos)': ['margarina'],
  'Azeite, de oliva, extra virgem': ['azeite'],
  'Açúcar, refinado': ['açúcar'],
  'Mel, de abelha': ['mel'],
  'Achocolatado, pó': ['achocolatado', 'nescau', 'toddy'],
  'Chocolate, ao leite': ['chocolate', 'barra de chocolate'],
  'Banana, prata, crua': ['banana'],
  'Maçã, Fuji, com casca, crua': ['maçã'],
  'Laranja, pêra, crua': ['laranja'],
  'Laranja, pêra, suco': ['suco de laranja'],
  'Mamão, Papaia, cru': ['mamão', 'papaia'],
  'Melancia, crua': ['melancia'],
  'Abacate, cru': ['abacate'],
  'Uva, Itália, crua': ['uva'],
  'Morango, cru': ['morango'],
  'Açaí, polpa, congelada': ['açaí'],
  'Alface, crespa, crua': ['alface', 'salada'],
  'Tomate, com semente, cru': ['tomate'],
  'Cenoura, crua': ['cenoura'],
  'Brócolis, cozido': ['brócolis'],
  'Refrigerante, tipo cola': ['refrigerante', 'coca', 'coca cola', 'refri'],
  'Refrigerante, tipo guaraná': ['guaraná'],
  'Cerveja, pilsen 2': ['cerveja', 'cerva', 'chopp'],
  'Pipoca, com óleo de soja, sem sal': ['pipoca'],
  'Pastel, de carne, frito': ['pastel'],
  'Coxinha de frango, frita': ['coxinha'],
}

/**
 * Regrava os apelidos de origem 'lista' a partir da lista atual (não persiste: quem chama salva se quiser).
 * Nomes que não existirem na TACO do banco são ignorados.
 */
export function sincronizarApelidosLista(b: Banco, lista: Record<string, string[]> = APELIDOS_LISTA): void {
  b.db.run('BEGIN')
  try {
    b.db.run("DELETE FROM apelidos WHERE origem = 'lista'")
    const achar = b.db.prepare("SELECT id FROM alimentos WHERE nome = ? AND origem = 'TACO' LIMIT 1")
    const inserir = b.db.prepare(
      "INSERT OR IGNORE INTO apelidos (alimento_id, termo, termo_busca, origem) VALUES (?, ?, ?, 'lista')",
    )
    for (const [nome, termos] of Object.entries(lista)) {
      achar.bind([nome])
      const id = achar.step() ? (achar.get()[0] as number) : null
      achar.reset()
      if (id === null) continue
      for (const t of termos) inserir.run([id, t, termoBusca(t)])
    }
    achar.free()
    inserir.free()
    b.db.run('COMMIT')
  } catch (e) {
    b.db.run('ROLLBACK')
    throw e
  }
}
