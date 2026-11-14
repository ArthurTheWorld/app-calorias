---
tags: [app-calorias, design]
data: 2026-11-14
status: aprovado (protótipo v1)
---

# App de Calorias — Design v1 (protótipo)

## Intenção
App pessoal do Arthur para usar **no celular Android**, inspirado no Yazio, para controlar calorias e manter **déficit calórico**. Uso só dele. É um protótipo que vai evoluir com o tempo — sem prazo; visual e funções extras vêm depois.

## Objetivos (v1)
1. Registrar refeições (alimento + quantidade) e somar as kcal do dia.
2. Calcular o gasto do dia a partir do perfil (altura, peso, idade, sexo) + treinos registrados.
3. Mostrar quanto ainda dá pra comer para bater a meta de déficit.
4. Registrar treinos.
5. Histórico: dia, mês e meses anteriores; **sequência (streak) de dias em déficit** (atual e recorde).
6. Banco **exportável** para análise no computador (`.sqlite` + CSV).

## Fora do escopo agora (depois)
Água, jejum, receitas, scanner de código de barras, registro por voz/IA, visual caprichado estilo Yazio, sincronização entre aparelhos.

## Anti-objetivos
- Perder dados (sem backup = falha). Exportação precisa ser fácil.
- Registro lento: adicionar um alimento deve levar poucos toques.
- Meta de consumo insegura: nunca abaixo do gasto basal.

## Restrições
- Android, Chrome. Sem servidor. Custo zero.
- Dados ficam no aparelho.

## Abordagens consideradas
| Abordagem | Prós | Contras |
|---|---|---|
| **PWA (React+TS+Vite) + SQLite no navegador** ✅ escolhida | Instala pela tela inicial, iteração rápida, atualização instantânea, sem custo | Dados só no aparelho (mitigado com exportação) |
| Expo/React Native + SQLite | Cara de app nativo, câmera mais fácil | Build pesado a cada mudança, mais setup |
| Flutter | Nativo | Linguagem nova (Dart), sem ganho real |

Escolha: PWA — mais rápido para usar de verdade e iterar no visual juntos.

## Decisões (do Arthur)
- Celular Android; uso principal no celular.
- Banco exportável para comparar no computador.
- Escopo v1 = registro, consumo do dia, déficit, streak/histórico, treinos.
- Protótipo aprovado; evolução incremental.

## Design técnico (proposta do Claude)
- **Stack:** React + TypeScript + Vite + vite-plugin-pwa. SQLite via `sql.js` (WASM), persistido em IndexedDB. Hospedagem: GitHub Pages (conta ArthurTheWorld).
- **Tabelas:**
  - `perfil` (altura_cm, peso_kg, idade, sexo, deficit_meta_kcal)
  - `alimentos` (id, nome, kcal_100g, proteina_g, carbo_g, gordura_g, origem: TACO|custom)
  - `refeicoes` (id, data, tipo: cafe|almoco|jantar|lanche, alimento_id, gramas, kcal)
  - `treinos` (id, data, tipo, duracao_min, kcal)
- **Cálculos:**
  - Basal (Mifflin-St Jeor): 10·peso + 6,25·altura − 5·idade + 5 (homem) / −161 (mulher)
  - Gasto do dia = basal × 1,2 + kcal dos treinos
  - Meta de consumo = max(gasto − déficit_meta, basal); déficit padrão 500 kcal
  - Treino: kcal = MET × peso × horas (editável)
- **Dia em déficit:** consumido < gasto do dia; só conta dias com registro. Streak = dias consecutivos em déficit.
- **Telas:** Hoje (anel consumido/restante + refeições) · Adicionar (busca + gramas) · Treino · Histórico (calendário mensal, streak atual/recorde, resumo por mês) · Perfil/Exportar.
- **Base de alimentos:** TACO (Unicamp) embutida + cadastro de alimentos próprios.

## Deixado para quem constrói
Biblioteca de UI/gráficos, layout exato, tabela de METs, formato dos CSVs.
