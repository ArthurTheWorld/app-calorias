---
tags: [app-calorias, design]
data: 2026-11-14
status: aprovado (2026-11-14)
---

# Apelidos de busca

## Intenção
Encontrar os alimentos pelo nome do dia a dia ("arroz branco", "carne moída", "pãozinho"), e não só pelo nome técnico da TACO. Isso mantém o registro rápido, que é um anti-objetivo da v1 ("registro lento"). O Arthur escolheu **lista pronta + apelidos dele**, para que o app aprenda o vocabulário dele sem depender de pedir cada nome.

## Hoje
`buscarAlimentos` exige que todas as palavras apareçam em `nome_busca`, e ordena por "próprios primeiro" e depois pelo nome mais curto. "arroz branco" não encontra nada, e "arroz" mostra o integral primeiro.

## Abordagens
| Abordagem | Trocas | Escolha |
|---|---|---|
| **Tabela `apelidos` (alimento, termo, origem lista/usuário), consultada junto na busca** | Um lugar só para os dois tipos de apelido. Apagar ou editar é simples. A lista do app pode mudar a cada versão sem mexer nos dados do Arthur. | **Escolhida** |
| Escrever os apelidos dentro de `nome_busca` | Sem tabela nova, mas o apelido do usuário fica misturado no texto e não dá para listar nem apagar | Não |
| Trocar palavras na hora de buscar ("branco" → "tipo 1") | Frágil: "branco" também aparece em outros alimentos | Não |

## Design
- **Banco (migração v3):** `apelidos (id, alimento_id → alimentos, termo, termo_busca, origem 'lista'|'usuario')`, com índice em `termo_busca`. Backups v1 e v2 continuam importando: a validação de backup segue exigindo só as 4 tabelas antigas, e a tabela nova é criada pela migração.
- **Lista pronta (`src/db/apelidos.ts`):** cerca de 50 alimentos do dia a dia, cada um apontando para o **nome exato** da TACO. Exemplos:
  - "arroz", "arroz branco" → *Arroz, tipo 1, cozido*
  - "feijão" → *Feijão, carioca, cozido*
  - "carne moída" → *Carne, bovina, acém, moído, cozido*
  - "frango grelhado", "peito de frango" → *Frango, peito, sem pele, grelhado*
  - "pão francês", "pãozinho" → *Pão, trigo, francês*
  - "ovo cozido" → *Ovo, de galinha, inteiro, cozido/10minutos*
  - "café" → *Café, infusão 10%*

  Ao abrir, o app sincroniza: apaga os apelidos `origem='lista'` e grava a lista atual. **Os apelidos do usuário nunca são apagados por isso.** Um teste garante que todo nome da lista existe na TACO.
- **Busca:** um alimento aparece se todas as palavras estão no nome **ou** em algum apelido dele. Ordem: alimentos encontrados por apelido primeiro (os do usuário antes dos da lista), depois os cadastrados pelo Arthur, depois os nomes mais curtos. Assim, "arroz" mostra *Arroz, tipo 1, cozido* no topo.
- **Ensinar um apelido (na tela Adicionar):** quando a busca não encontra nada, aparece, junto de "Nada encontrado", o botão **"Ensinar 'marmita da vó'"**. Ao tocar, o campo é limpo e um aviso diz "Procure o alimento que 'marmita da vó' quer dizer". Quando ele escolhe o alimento, o apelido é salvo (`origem='usuario'`) e a tela segue normalmente para as gramas, sem toque a mais. Também vale para alimentos que ele mesmo cadastrou.
- **Gerenciar (Perfil):** o cartão "Seus apelidos" lista "termo → alimento", com × para apagar. Só aparece se houver algum.
- **Exportação:** `apelidos` entra nos CSVs e no `.sqlite`.

## Fora do escopo
Busca tolerante a erro de digitação, sugestão automática de apelido, editar os apelidos da lista pronta.

## Testes
Migração v2 → v3 (com dados) e backups v1 e v2 importando; sincronização da lista sem tocar nos apelidos do usuário; todo nome da lista existe em `public/taco.json`; busca por apelido, ordem dos resultados e "arroz branco"; fluxo de ensinar um apelido na tela; apagar um apelido no Perfil.
