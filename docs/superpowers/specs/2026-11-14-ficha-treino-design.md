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
