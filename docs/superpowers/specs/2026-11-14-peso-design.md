---
tags: [app-calorias, design]
data: 2026-11-14
status: aprovado (2026-11-14)
---

# Registro de peso

## Intenção
Registrar o peso ao longo do tempo para que **cada dia use o peso daquela data**. Hoje mudar o peso no Perfil recalcula o passado e mexe no recorde e nas conquistas. A **análise do peso não fica no app**: toda semana o Arthur exporta o banco para o PC, e a análise é feita aqui. O app continua simples e sem cobrança.

## Abordagens
| Abordagem | Trocas | Escolha |
|---|---|---|
| **Tabela `pesos` (data, peso); o peso de um dia é o último registro até aquela data** | O histórico fica correto, a exportação já sai pronta para análise, e o perfil continua com um peso "atual" | **Escolhida** |
| Guardar o peso em cada dia de refeição | Duplica o dado e não cobre dias sem registro | Não |
| Tela de evolução com gráfico e meta no app | O Arthur pediu a análise no PC; isso arriscaria virar cobrança | Não |

## Design
- **Banco (v4):** `pesos (id, data TEXT UNIQUE, peso_kg REAL CHECK 30–300)`. Na migração, se `pesos` estiver vazia e houver perfil, o peso do perfil vira o primeiro registro, com a data do primeiro dia registrado (ou de hoje, se não houver registros). Assim os dias antigos continuam com o peso que já usavam.
- **Peso de um dia:** o último registro com `data ≤ dia`. Antes do primeiro registro, vale o primeiro. `perfil.peso_kg` acompanha sempre o registro mais recente.
- **Contas:**
  - Histórico, painel, conquistas e a tela Hoje (inclusive dias anteriores) usam o peso de cada dia.
  - A sugestão de calorias do treino usa o peso mais recente.
- **Perfil:**
  - O campo "Peso" do formulário só aparece no primeiro cadastro. Ao salvar, ele vira o primeiro registro.
  - Depois disso, o peso muda pelo cartão **"Peso"**:
    - um campo e o botão **Registrar**, que salva no dia de hoje do app. Registrar de novo no mesmo dia substitui o anterior;
    - a lista das últimas 10 pesagens (data e kg), com × para apagar. O último registro restante não pode ser apagado.
- **Exportação:** `pesos` entra no `.sqlite` e nos CSVs. Backups v1 a v3 continuam válidos.
- **Rotina no PC:** a pasta `C:\Users\luiza\Documents\app-calorias-dados\` recebe os `.sqlite` semanais. O Arthur pede "analisa a semana", e o Claude lê o mais recente.

## Fora do escopo
Gráfico de peso, meta de peso, lembrete de pesagem e importação automática do celular.

## Testes
- **Migração:** v3 → v4, incluindo a semeadura a partir do perfil e um banco sem perfil.
- **Peso na data:** antes do primeiro registro, entre registros e depois do último.
- **Registro do dia:** registrar duas vezes no mesmo dia substitui o anterior.
- **Apagar:** não é possível apagar o último registro restante.
- **Passado estável:** um déficit antigo não muda depois de registrar um peso novo.
- **Telas:**
  - Perfil: o cartão Peso aparece, e o campo Peso só existe no primeiro cadastro.
  - Hoje: num dia antigo, o gasto usa o peso daquele dia.
  - Treino: a sugestão de calorias usa o peso mais recente.
