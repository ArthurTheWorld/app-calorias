# Ficha de treino — design (curto)

## Por quê
O treino de musculação está no MFit e vai ser trocado. O usuário quer o treino novo dentro do App Calorias, fazendo o que ele usa no MFit: ver o treino, marcar o que fez e anotar a carga. Monitoramento sem cobrança, como o resto do app.

## Objetivos
- Mostrar a ficha (Treino A, B, C… com exercícios, séries × repetições).
- Marcar cada exercício como feito no dia.
- Anotar a carga do dia (kg) por exercício e ver a carga da última vez ao lado.
- Guardar o histórico de cargas no banco do celular (entra no backup e na exportação).

## Fora do escopo
- Editor de ficha no app (decisão do usuário: opção 1).
- Cronômetro de descanso, carga por série, gráficos de evolução no app.
- Importar automaticamente do MFit (não tem exportação).

## Anti-objetivos
- Nada de vermelho, aviso de treino pulado ou cobrança.
- Não somar kcal automaticamente: o registro de gasto calórico continua como está.

## Abordagens
1. **Ficha no código, eu cadastro e publico** — escolhida. O usuário manda os prints, a ficha vira uma lista em `src/treino/ficha.ts`; trocar de treino = novo commit e publicação.
2. Editor dentro do app — descartada: mais trabalho e digitação no celular para algo que muda a cada 1–2 meses.

## Como fica
- Na aba **Treino** já existente, a ficha fica no topo; o formulário de kcal gastas continua embaixo. (Chamada minha: evita duas abas de treino.)
- Chips com as divisões (A, B, C…). Abre na divisão seguinte à última feita; o usuário pode trocar.
- Cada exercício: caixa de marcar, nome, "4 × 10", campo "hoje: [ ] kg" e "última: 30 kg" (some se nunca registrou). Carga é opcional (abdominal, cardio).
- Tudo grava na hora, por dia do app (vira às 05:00). Digitar uma carga válida marca o exercício como feito; desmarcar apaga o registro do dia (e a carga). Carga aceita vírgula ("32,5"), maior que 0 e até 500 kg; inválida não grava.
- Enquanto a ficha estiver vazia (antes dos prints), a seção não aparece e a aba fica como hoje. (Pedido do usuário: deixar tudo pronto, só faltando cadastrar o treino.)
- "Última" = a carga mais recente de um dia anterior para o exercício de mesmo nome, mesmo se a ficha mudou.

## Dados
- Banco v6: tabela `exercicios_feitos (id, data, divisao, exercicio, carga_kg REAL NULL, UNIQUE(data, exercicio))`. Desmarcar apaga a linha.
- Exportação/backup incluem a tabela nova; backups antigos continuam válidos.

## Fica para quem constrói
- Nomes de componentes, estilos seguindo o visual "Painel de status".

## Mudança em 2026-11-15: editor no app (substitui a abordagem 1)
O usuário pediu para cadastrar os exercícios ele mesmo, com a aba pronta. Aprovado:
- Ficha sai do código e vai para o banco (v7): `divisoes (id, nome, titulo, ordem)` e `exercicios_ficha (id, divisao_id, nome, series, reps, obs, ordem)`.
- Ficha vazia: cartão "Ficha de treino" com "Montar ficha" (cria a divisão A e abre o editor). Ficha montada: botão "Editar ficha".
- Editor: chips das divisões + "+ Divisão" (próxima letra livre), campos "Nome da divisão" e "Descrição"; lista de exercícios "Nome · 4 × 10" com ↑ ↓ ✎ ×; formulário Nome, Séries, Repetições (texto livre), Observação (opcional), "Salvar exercício"; "Remover divisão X" com confirmação; "Pronto".
- Grava na hora. Remover exercício/divisão não apaga histórico. Corrigir o nome (✎) leva o histórico de cargas junto; renomear divisão também atualiza o histórico.
- Chamadas minhas: nome de divisão único e não vazio; exercício com nome repetido na mesma divisão é recusado; séries inteiras de 1 a 20; novo exercício abre com 4 × 10.
