---
tags: [app-calorias, design]
data: 2026-11-14
status: aprovado (2026-11-14)
---

# App de Calorias: visual gamificado e refeições (v2)

## Intenção e o porquê

O Arthur quer o app com cara de jogo, mas **sem cobrança**. Nas palavras dele: "só monitoramento, sem cobrança além da conta, monitorar para que eu tenha consciência para eu melhorar no dia seguinte."

O jogo serve para **tornar o dia fácil de enxergar e agradável de acompanhar**, não para pressionar. O sucesso é ele abrir o app, entender rápido como foi hoje e ontem, e sentir que registrar vale a pena mesmo num dia ruim.

Ele também pediu que as refeições sigam a ordem real do dia e que haja uma refeição para quando come de madrugada, sem sono.

## Objetivos

1. **Refeições na ordem do dia:** Café da manhã → Almoço → Lanche da tarde → Jantar → Madrugada.
2. **Visual "Painel de status"**, escolhido pelo Arthur nos modelos: fundo preto puro, acento **violeta claro `#c77dff`** com brilho leve, ícones de linha (SVG) **no lugar de emojis**, rótulos pequenos em maiúsculas e números grandes. Vale para **todas as telas**.
3. **Camada de jogo calculada a partir dos dados** (abordagem escolhida): dia do jogo, XP, nível, conquistas e o fechamento de ontem.
4. **Painel na tela Hoje** com energia restante, sequência e recorde, média de 7 dias, ontem e registros.

## Fora do escopo

Notificações, sons, ranking ou comparação com outras pessoas, registro de peso, apelidos de busca da TACO (ficam para outra versão).

## Anti-objetivos (falha mesmo que funcione)

- **Bronca ou punição:** nada de vermelho, nada de mensagem negativa, e **o XP nunca diminui por resultado**. Um dia acima do gasto é informação neutra.
- **Perder dados** na mudança do banco (a tabela de refeições precisa ser reconstruída; ver Restrições).
- **Registro mais lento:** o fluxo de adicionar um alimento não pode ganhar toques.
- **Cara de IA:** degradês chamativos, brilho em tudo, ilustração genérica. O brilho fica só nos poucos pontos de destaque.

## Restrições

- PWA atual (React 19 + TS + Vite + sql.js no IndexedDB), sem servidor, dados só no aparelho.
- O banco no celular tem `CHECK (tipo IN ('cafe','almoco','jantar','lanche'))` na tabela `refeicoes`. SQLite não altera CHECK, então **é preciso reconstruir a tabela** (criar a nova, copiar, trocar) numa migração versionada com `PRAGMA user_version`, dentro de uma transação. A migração roda em `abrirBanco`, então vale também para **backups antigos importados**.
- Os 33 testes atuais continuam passando (ajustados onde a ordem e os nomes mudarem).
- Antes de publicar, o Arthur vê o resultado e aprova (preferência dele).

## Abordagens consideradas

| Abordagem | Trocas | Escolha |
|---|---|---|
| **1. Calcular XP, nível e conquistas a partir das refeições e treinos** | Sempre consistente com os dados (editar, apagar, registrar atrasado e importar backup se ajustam sozinhos) e já conta o histórico existente. Data exata de desbloqueio fica aproximada (calculada). | **Escolhida pelo Arthur** |
| 2. Gravar XP e conquistas no banco quando acontecem | Data exata e recompensas por horário, mas o XP desincroniza ao editar e o backup antigo não traz conquistas. | Não |
| 3. Biblioteca pronta de gamificação ou UI | Muito código para pouco ganho e impõe outro visual. | Descartada |

## O que foi decidido com o Arthur

- Direção visual B (Painel de status), roxo **violeta claro** (variante 2), menos emojis.
- Abordagem 1.
- Ordem e nomes das refeições acima, incluindo Madrugada.
- Tom: monitoramento sem cobrança, foco em consciência para o dia seguinte.

## Decisões do Claude (o Arthur pode corrigir)

### Refeições
- Tipos no banco: `cafe`, `almoco`, `lanche`, `jantar`, `madrugada`. O tipo `lanche` existente vira **"Lanche da tarde"** (os registros antigos de "Lanches" passam a aparecer ali).
- **Madrugada pertence ao dia que está terminando.** Regra geral: **o dia do app vira às 05:00**. Entre 00:00 e 04:59, "hoje" no app ainda é o dia anterior, então um lanche às 2h de sábado entra na sexta. Isso vale para tudo que usa "hoje" (tela Hoje, treino só no dia de hoje, sequência). Implementar em `hojeLocal()` com um deslocamento de 5h.
- **Madrugada registrada depois das 05:00 (decidido pelo Arthur):** se ele está no hoje real e escolhe "+ Madrugada" entre 05:00 e 11:59, a refeição é salva no **dia anterior**, sem tocar a mais. Ao salvar, um aviso curto diz em que dia foi ("Salvo na madrugada de sexta"). Se ele estiver vendo um dia anterior pela navegação, a Madrugada vai para o dia que está na tela.

### Camada de jogo (funções puras em `src/calc/jogo.ts`, com testes)
- **"Dia registrado" = dia com pelo menos uma refeição** (mesma regra de `resumirDias`). Um dia só com treino ganha o XP do treino, mas não conta como dia registrado. Essa definição vale para todas as contagens: conquistas, "Registros", calendário e Dia N.
- **Só dias fechados contam para resultado.** Sequência, recorde, média de 7 dias e as conquistas de déficit (5 e 6) usam apenas dias **anteriores a hoje**. Hoje, ainda incompleto, não liga nem desliga nada. Assim uma conquista não aparece de manhã e some depois do jantar. As conquistas de registro (1 a 4, 7 a 9) podem contar hoje, porque registrar não se desfaz sozinho.
- **Limite conhecido:** o gasto usa o peso atual do perfil (decisão da v1). Mudar o peso recalcula os déficits antigos e pode alterar o recorde e as conquistas de déficit. Isso se resolve com o registro de peso, numa versão futura.
- **Referência de data:** o painel, a camada de jogo e o fechamento sempre se referem ao **hoje real** do app. Ao navegar para um dia anterior (‹), a tela mostra a energia e as refeições daquele dia, sem o painel de jogo e sem o fechamento. As funções recebem a data de referência como parâmetro, para facilitar os testes.
- **Dia N:** quantidade de dias corridos desde o primeiro dia registrado, contando esse primeiro como Dia 1.
- **XP só por registrar, nunca por resultado:**
  - +10 por dia com pelo menos uma refeição;
  - +5 por tipo de refeição registrado no dia (até +25);
  - +15 por dia com treino.
  - O XP só cai se o próprio registro for apagado, porque é recalculado a partir dos dados.
- **Nível:** o nível *n* exige 100·*n* XP a mais que o anterior (nível 2 = 100, nível 3 = 300, nível 4 = 600…). Mostrar "LV n · X XP" e a barra até o próximo nível na tela Hoje ou no Perfil. Os números podem ser ajustados depois.
- **Conquistas** (ícone de linha cada, calculadas; as bloqueadas aparecem apagadas e tracejadas, como no modelo):
  1. Primeiro registro
  2. 7 dias registrados (no total)
  3. 30 dias registrados
  4. Semana completa: 7 dias seguidos com registro
  5. 3 dias seguidos em déficit
  6. 7 dias seguidos em déficit
  7. Primeiro treino
  8. 10 treinos
  9. Dia completo: café, almoço, lanche e jantar registrados no mesmo dia
- **"Próxima conquista":** a bloqueada mais perto de sair, com o que falta ("faltam 2 dias seguidos registrando").
- **Painel de status (Hoje):**
  - Energia restante: meta − consumido, com barra.
  - Sequência em déficit atual e recorde (regra atual de `streak`).
  - Média de déficit dos últimos 7 dias com registro.
  - Déficit de ontem.
  - Registros: dias com registro nos últimos 14.
  - Valores acima do gasto aparecem com sinal "+" em cinza ou âmbar suave, nunca em vermelho.
- **Fechamento de ontem** (cartão na tela Hoje, só se ontem tiver registro): kcal de ontem e diferença para o gasto, mais uma frase sobre as refeições. Frase factual, sem conselho:
  - Se alguma refeição ficou acima da própria média nos 7 dias registrados anteriores, cita a que mais passou, em kcal: "Ontem: 1.770 kcal, 180 abaixo do gasto. O jantar foi 620 kcal, acima da sua média de 480."
  - Se nenhuma passou da média, cita a maior refeição sem comparar: "A maior refeição foi o almoço, com 710 kcal."
  - Uma refeição sem histórico anterior (ex.: a primeira Madrugada) não entra na comparação.

### Visual
- Tokens: `--fundo #000`, `--bloco #0b0b0e`, `--borda #1e1e24`, `--texto #f2f2f2`, `--suave #8a8a96`, `--acento #c77dff`, `--neutro-alto #e0b36a` (âmbar suave para "acima do gasto"). Brilho (`box-shadow`/`text-shadow` com o acento) só no número principal, na barra de energia, nos botões + e nas conquistas desbloqueadas.
- Ícones: SVGs de linha próprios e inline (xícara, sol, pôr do sol, lua, estrelas, chama, calendário, troféu, haltere), cor do acento.
- Telas: Hoje (painel), Adicionar, Treino, Histórico (calendário com dias em déficit em violeta e dias acima do gasto em âmbar suave, mais a lista completa de conquistas) e Perfil (nível e XP, além do que já tem). Barra de abas inferior com ícones.
- Manifesto PWA e `theme_color` pretos. O ícone do app ganha a versão em preto e violeta.

## Testes

- Migração: abrir um banco no formato antigo (com o CHECK antigo e registros de todos os tipos), migrar e conferir que todos os registros continuam e que `madrugada` passa a ser aceito. Rodar duas vezes não pode quebrar nada.
- Funções de jogo: XP, nível, conquistas, próxima conquista e fechamento de ontem, com casos de dias vazios, primeiro dia e dias acima do gasto.
- Virada do dia às 05:00.
- Telas: ordem das refeições e presença de Madrugada.

## Deixado para quem constrói

Layout fino de cada tela, desenho exato dos ícones, animações (se houver, discretas), textos de cada conquista, como a barra de abas mostra a aba ativa.
