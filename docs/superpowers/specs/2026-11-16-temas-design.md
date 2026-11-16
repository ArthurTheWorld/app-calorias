# Temas de cor (design curto)

Aprovado pelo Arthur em 2026-11-16 ("Pode sim").

- **Por quê:** ele quer variar a cor do app mantendo o fundo preto: hoje é preto e roxo; quer também verde, rosa neon, vermelho e laranja.
- **Objetivo:** cinco temas, só a cor de destaque muda (`--acento`; o brilho deriva dela). Fundo, cartões, textos e o âmbar do saldo ficam iguais.
  - Roxo `#c77dff` (padrão), Verde `#5cf08a`, Rosa neon `#ff4fd8`, Vermelho `#ff5a5a`, Laranja `#ff9f43`.
- **Onde:** cartão "Tema" no Perfil, cinco bolinhas (grupo de rádio "Tema"); um toque aplica na hora.
- **Guardado:** `localStorage` do aparelho (preferência local; não vai no banco nem no Drive, para o tema não mudar quando o PC altera os dados). Aplicado antes do primeiro desenho, sem piscar roxo.
- **Não objetivos:** fundo de outra cor (fica para depois, com sugestões); ícone do app (o Android só lê na instalação); tema vermelho continua sem bronca (é só a cor do app).
- **Abordagens:** variável CSS no `:root` trocada por JS (escolhida, já que todo destaque usa `--acento`); classes CSS por tema (mais CSS repetido, sem ganho); guardar no banco (sincronizaria pelo Drive, o que não se quer).
