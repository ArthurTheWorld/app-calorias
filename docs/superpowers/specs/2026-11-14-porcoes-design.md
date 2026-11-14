---
tags: [app-calorias, design]
data: 2026-11-14
status: aprovado (2026-11-14)
---

# Porções (medidas caseiras)

## Intenção
Registrar com a medida que o Arthur usa no dia a dia (**1 xícara de café**, **1 ovo cozido**, **2 fatias de pão de forma**) em vez de pensar em gramas. O caso que motivou: a xícara de café de sempre só aceitava gramas. O app continua só monitorando, sem cobrança.

## Abordagens
| Abordagem | Trocas | Escolha |
|---|---|---|
| **Lista pronta + porções do usuário** (mesmo modelo dos apelidos) | Já funciona na instalação e se ajusta à xícara real dele | **Escolhida** |
| Só a lista pronta | Mais simples, mas a xícara/caneca dele pode não bater com o padrão | Não |
| Unidades genéricas (xícara, colher) valendo para todo alimento | 1 colher de arroz ≠ 1 colher de açúcar; dá números errados | Não |

## Design
- **Banco (v5):**
  - nova tabela `porcoes (id, alimento_id → alimentos, nome, gramas REAL > 0, origem 'lista'|'usuario', UNIQUE(alimento_id, nome, origem))`;
  - `refeicoes` ganha `qtd REAL` e `porcao TEXT`, ambas opcionais. Elas guardam o que foi escolhido, como "2 × Fatia". `gramas` e `kcal` continuam sendo a fonte das contas.
  - Registros antigos ficam com as duas em branco e continuam aparecendo em gramas.
- **Lista pronta:** `src/db/porcoes.ts` com cerca de 40 porções para alimentos TACO comuns. Exemplos:
  - café infusão: xícara (180 ml), cafezinho (50 ml);
  - ovo cozido/frito/cru: unidade (50 g);
  - pão francês: unidade (50 g);
  - pães de forma: fatia (25 g);
  - banana: unidade média (90 g);
  - arroz e feijão: colher de servir e concha.
  
  Ela é sincronizada a cada abertura do app, como os apelidos. Os valores são médias de tabelas de medidas caseiras, e eu escolho os números exatos (minha decisão).
- **Bebidas:** 1 ml = 1 g. O nome da porção mostra o volume ("Xícara (180 ml)").
- **Tela Adicionar, depois de escolher o alimento:**
  - uma fileira de botões com as porções do alimento: **Gramas**, as da lista, as do usuário e **+ Minha porção**;
  - campo **Quantidade** com botões grandes **−** e **+** que andam de 1 em 1 (1 → 2 → 3 ovos). O − não desce abaixo de 1, e frações como "1,5" ou "0,5" são digitadas no campo. Ao lado, o total em gramas e as kcal, ao vivo. No modo **Gramas** não há − e +, só o campo, como hoje;
  - **lembrança:** o alimento abre com a última porção e a última quantidade usadas nele. Na primeira vez, abre na primeira porção da lista, ou em Gramas/100 se não houver porção;
  - **+ Minha porção** pede nome e gramas (ou ml) e já seleciona a porção nova.
- **Tela Hoje:** cada item mostra "2 × Fatia · 50 g" quando foi registrado por porção. Se não foi, mostra "50 g", como hoje.
- **Perfil:** cartão **"Suas porções"**, com a lista e um × para apagar, igual a "Seus apelidos". As porções da lista pronta não aparecem nele.
- **Exportação:** `porcoes` entra no `.sqlite` e nos CSVs. Backups v1 a v4 continuam válidos.

## Fora do escopo (próximas etapas do item 1)
Recentes e favoritos, repetir refeição e pratos montados. Editar uma refeição já registrada também fica de fora.

## Observação
A TACO não tem pão de forma branco comum, só integral, aveia, milho e glúten. A fatia entra nesses. Para o pão branco, o caminho é cadastrar o alimento com os dados do rótulo e criar "Fatia" como porção dele.

## Testes
- **Migração v4 → v5:** as refeições antigas são preservadas, com `qtd` e `porcao` nulos.
- **Sincronização da lista:** ignora nomes TACO que não existem e não duplica.
- **Conta da refeição:** registrar 2 × Fatia (25 g) grava 50 g e as kcal certas.
- **Lembrança:** o alimento abre com a última porção e quantidade usadas; sem histórico, abre no padrão.
- **Minha porção:** criar, já selecionar, aparecer no Perfil e apagar.
- **Quantidade:** 0, vazio ou texto bloqueiam o botão Adicionar; "1,5" é aceito.
- **Botões − e +:** o + leva de 1 para 2 e as kcal se atualizam; o − não desce abaixo de 1; os botões não aparecem no modo Gramas.
- **Tela Hoje:** mostra "2 × Fatia · 50 g", e os registros antigos continuam em gramas.
