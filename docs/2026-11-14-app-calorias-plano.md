---
tags: [app-calorias, plano]
data: 2026-11-14
---

# App de Calorias v1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA Android pessoal que registra refeições e treinos, calcula gasto/meta de déficit e mostra streak e histórico, com banco SQLite exportável.

**Architecture:** App 100% no cliente. Lógica pura (cálculos, histórico) em `src/calc/`, testada sem UI. Acesso a dados em `src/db/` sobre `sql.js` (SQLite WASM), com o arquivo do banco persistido em IndexedDB após cada escrita. UI React em `src/telas/`, navegação por abas inferiores.

**Tech Stack:** Vite 5+, React 18+, TypeScript (strict), vite-plugin-pwa, sql.js, idb-keyval, Vitest + @testing-library/react, GitHub Pages.

**Spec:** `docs/2026-11-14-app-calorias-design.md`

## Global Constraints
- Idioma da interface: português do Brasil.
- Sem servidor; todos os dados no aparelho.
- Datas sempre em **data local** no formato `YYYY-MM-DD` (nunca `toISOString()`, que usa UTC).
- Déficit padrão: 500 kcal. Fator de atividade: 1,2.
- Meta de consumo nunca abaixo do gasto basal.
- Dia em déficit = consumido < gasto do dia; só dias com ao menos uma refeição registrada contam.
- Exportação: arquivo `.sqlite` + um CSV por tabela.

## Review Focus
1. Registro feito entre 21h e 23h59 deve cair no dia local correto (não no dia seguinte UTC).
2. Perfil ainda não preenchido: app abre direto no Perfil, sem quebrar ou mostrar NaN.
3. Gramas digitadas com vírgula ("150,5"), zero ou vazias: aceitar vírgula; recusar ≤ 0.
4. Dados sobrevivem a fechar o app e a uma atualização do PWA (persistência em IndexedDB).
5. Streak atravessando a virada de mês e com um dia sem registro no meio (dia sem registro quebra a sequência).

---

### Task 1: Projeto base + cálculos de energia

**Files:**
- Create: projeto Vite React-TS em `/` (`npm create vite@latest . -- --template react-ts`), `vitest.config.ts`
- Create: `src/calc/energia.ts`, `src/calc/datas.ts`
- Test: `src/calc/energia.test.ts`, `src/calc/datas.test.ts`

**Interfaces:**
- Produces:
  - `type Sexo = 'M' | 'F'`
  - `interface Perfil { alturaCm: number; pesoKg: number; idade: number; sexo: Sexo; deficitMeta: number }`
  - `tmb(p: Perfil): number`
  - `gastoDia(p: Perfil, kcalTreinos: number): number`
  - `metaConsumo(p: Perfil, kcalTreinos: number): number`
  - `kcalTreino(met: number, pesoKg: number, duracaoMin: number): number`
  - `hojeLocal(d?: Date): string` → `YYYY-MM-DD`
  - `parseGramas(txt: string): number | null`

- [ ] **Step 1: Testes falhando**
```ts
const p: Perfil = { alturaCm: 175, pesoKg: 80, idade: 25, sexo: 'M', deficitMeta: 500 };
test('tmb homem', () => expect(tmb(p)).toBeCloseTo(1798.75));      // 800+1093.75-125+5
test('tmb mulher', () => expect(tmb({ ...p, sexo: 'F' })).toBeCloseTo(1632.75));
test('gasto com treino', () => expect(gastoDia(p, 300)).toBeCloseTo(1798.75 * 1.2 + 300));
test('meta normal', () => expect(metaConsumo(p, 0)).toBeCloseTo(1798.75 * 1.2 - 500));
test('meta nunca abaixo do basal', () => expect(metaConsumo({ ...p, deficitMeta: 2000 }, 0)).toBeCloseTo(1798.75));
test('kcal treino', () => expect(kcalTreino(8, 80, 60)).toBe(640));
test('hojeLocal 23h', () => expect(hojeLocal(new Date(2026, 10, 14, 23, 30))).toBe('2026-11-14'));
test('gramas vírgula', () => expect(parseGramas('150,5')).toBe(150.5));
test('gramas inválidas', () => { expect(parseGramas('0')).toBeNull(); expect(parseGramas('')).toBeNull(); expect(parseGramas('-3')).toBeNull(); });
```
- [ ] **Step 2:** `npx vitest run src/calc` → FAIL (módulos não existem)
- [ ] **Step 3:** Implementar as funções (Mifflin-St Jeor: 10·peso + 6,25·altura − 5·idade + 5 / −161; `hojeLocal` com `getFullYear/getMonth/getDate`).
- [ ] **Step 4:** `npx vitest run src/calc` → PASS
- [ ] **Step 5:** `git init && git add -A && git commit -m "feat: projeto base e cálculos de energia"`

### Task 2: Banco SQLite (sql.js + IndexedDB)

**Files:**
- Create: `src/db/schema.sql.ts`, `src/db/banco.ts`, `src/db/repos.ts`
- Test: `src/db/repos.test.ts`

**Interfaces:**
- Consumes: `Perfil` (Task 1)
- Produces:
  - `abrirBanco(dados?: Uint8Array): Promise<Banco>`; `Banco` tem `salvar(): Promise<void>` (grava `db.export()` no IndexedDB, chave `'banco'`) e `exportar(): Uint8Array`
  - Tabelas: `perfil(id=1, altura_cm, peso_kg, idade, sexo, deficit_meta)`, `alimentos(id, nome, kcal_100g, proteina_g, carbo_g, gordura_g, origem CHECK IN ('TACO','custom'))`, `refeicoes(id, data, tipo CHECK IN ('cafe','almoco','jantar','lanche'), alimento_id, gramas, kcal)`, `treinos(id, data, tipo, duracao_min, kcal)`
  - `getPerfil(b): Perfil | null`, `salvarPerfil(b, p)`
  - `buscarAlimentos(b, termo: string, limite = 20): Alimento[]` (busca sem acento/caixa)
  - `criarAlimento(b, a: Omit<Alimento,'id'>): number`
  - `addRefeicao(b, r: { data; tipo; alimentoId; gramas }): void` — calcula `kcal = kcal_100g * gramas / 100` e grava
  - `refeicoesDoDia(b, data): RefeicaoView[]`, `removerRefeicao(b, id)`
  - `addTreino(b, t)`, `treinosDoDia(b, data)`, `removerTreino(b, id)`
  - `totaisPorDia(b, de: string, ate: string): { data: string; consumido: number; treinos: number }[]`

- [ ] **Step 1: Testes falhando** (sql.js em Node, banco em memória)
```ts
test('perfil vazio retorna null', ...)            // getPerfil → null
test('refeicao calcula kcal', ...)                 // arroz 128 kcal/100g, 150 g → 192
test('busca ignora acento', ...)                   // 'feijao' acha 'Feijão'
test('totaisPorDia soma refeições e treinos', ...)
test('exportar e reabrir preserva dados', ...)     // abrirBanco(b.exportar()) mantém linhas
```
- [ ] **Step 2:** `npx vitest run src/db` → FAIL
- [ ] **Step 3:** Implementar; `salvar()` chamado pelos repos após toda escrita.
- [ ] **Step 4:** `npx vitest run src/db` → PASS
- [ ] **Step 5:** Commit `feat: banco sqlite com persistência`

### Task 3: Base TACO embutida

**Files:**
- Create: `scripts/gerar-taco.ts`, `public/taco.json`, `src/db/seed.ts`
- Test: `src/db/seed.test.ts`

**Interfaces:**
- Produces: `semearTaco(b: Banco, itens: AlimentoTaco[]): number` — insere só se não houver linhas `origem='TACO'`; retorna quantos inseriu.

- [ ] **Step 1:** Teste: semear duas vezes → segunda retorna 0; item com kcal ausente ("NA"/"Tr") é pulado.
- [ ] **Step 2:** Rodar → FAIL
- [ ] **Step 3:** Baixar TACO 4ª ed. de um repositório público no GitHub; `scripts/gerar-taco.ts` normaliza para `{nome, kcal_100g, proteina_g, carbo_g, gordura_g}` ("Tr" = 0, "NA" = pular kcal). Implementar `semearTaco`.
- [ ] **Step 4:** PASS; conferir `public/taco.json` com ~590 itens.
- [ ] **Step 5:** Commit `feat: base TACO`

### Task 4: Histórico e streak

**Files:**
- Create: `src/calc/historico.ts`
- Test: `src/calc/historico.test.ts`

**Interfaces:**
- Consumes: `gastoDia`, `Perfil` (Task 1); formato de `totaisPorDia` (Task 2)
- Produces:
  - `interface DiaResumo { data: string; consumido: number; gasto: number; deficit: number; emDeficit: boolean }`
  - `resumirDias(p: Perfil, totais: {data;consumido;treinos}[]): DiaResumo[]` (só dias com consumido > 0)
  - `streak(dias: DiaResumo[], hoje: string): { atual: number; recorde: number }`
  - `resumoMes(dias: DiaResumo[], mes: string /* YYYY-MM */): { diasRegistrados; diasEmDeficit; deficitTotal; mediaConsumo }`

- [ ] **Step 1: Testes falhando**
```ts
test('streak atravessa mês', ...)        // 30/10, 31/10, 01/11 em déficit, hoje 01/11 → atual 3
test('dia sem registro quebra', ...)     // 10, 11, (12 vazio), 13 → atual 1, recorde 2
test('hoje sem registro não zera', ...)  // ontem e anteontem em déficit, hoje vazio → atual 2
test('resumoMes', ...)                   // soma déficit e conta dias corretamente
```
- [ ] **Step 2:** FAIL · **Step 3:** implementar · **Step 4:** PASS · **Step 5:** Commit `feat: histórico e streak`

### Task 5: Telas Perfil, Hoje e Adicionar

**Files:**
- Create: `src/App.tsx` (abas: Hoje, Treino, Histórico, Perfil), `src/estado.tsx` (contexto com `Banco`), `src/telas/Perfil.tsx`, `src/telas/Hoje.tsx`, `src/telas/Adicionar.tsx`, `src/componentes/Anel.tsx`
- Test: `src/telas/Hoje.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3

- [ ] **Step 1:** Testes: sem perfil → mostra Perfil; com perfil e uma refeição de 192 kcal → Hoje mostra "192" consumido e restante = `metaConsumo − 192` arredondado.
- [ ] **Step 2:** FAIL · **Step 3:** implementar (Hoje: anel consumido/meta, lista por café/almoço/jantar/lanche com botão "+" e remover; Adicionar: busca com debounce, gramas via `parseGramas`, opção "cadastrar alimento") · **Step 4:** PASS
- [ ] **Step 5:** Commit `feat: telas perfil, hoje e adicionar`

### Task 6: Tela Treino

**Files:** Create `src/telas/Treino.tsx`, `src/calc/mets.ts` (tabela pequena: musculação 5, corrida 9,8, caminhada 3,5, bike 7,5, futebol 7, outro → kcal manual). Test `src/telas/Treino.test.tsx`.

- [ ] **Step 1:** Teste: registrar musculação 60 min com peso 80 → sugere 400 kcal, editável; após salvar, Hoje mostra gasto aumentado em 400.
- [ ] **Step 2–4:** FAIL → implementar → PASS · **Step 5:** Commit `feat: treinos`

### Task 7: Tela Histórico

**Files:** Create `src/telas/Historico.tsx`, `src/componentes/Calendario.tsx`. Test `src/telas/Historico.test.tsx`.

- [ ] **Step 1:** Teste: mês com 2 dias em déficit e 1 acima → calendário marca 2 verdes e 1 vermelho; mostra streak atual/recorde; setas navegam para o mês anterior.
- [ ] **Step 2–4:** FAIL → implementar (cards: streak, resumo do mês; lista de meses anteriores com `resumoMes`) → PASS · **Step 5:** Commit `feat: histórico`

### Task 8: Exportar, PWA e deploy

**Files:** Create `src/exportar.ts`, modificar `src/telas/Perfil.tsx`, `vite.config.ts` (vite-plugin-pwa, `base: '/app-calorias/'`), `public/icon-192.png`, `public/icon-512.png`, `.github/workflows/deploy.yml`. Test `src/exportar.test.ts`.

**Interfaces:**
- Produces: `tabelaParaCsv(b: Banco, tabela: string): string` (separador `;`, decimal com ponto, cabeçalho na 1ª linha); botões "Exportar .sqlite" e "Exportar CSVs" no Perfil (download via `Blob`); botão "Importar .sqlite" para restaurar backup.

- [ ] **Step 1:** Teste CSV: cabeçalho correto e nome com `;` escapado entre aspas.
- [ ] **Step 2–4:** FAIL → implementar → PASS
- [ ] **Step 5:** `npm run build` sem erros; `npx vitest run` tudo verde.
- [ ] **Step 6:** Commit, criar repo `ArthurTheWorld/app-calorias`, push; Pages publica; instalar no Android pelo Chrome ("Adicionar à tela inicial") e verificar: registrar, fechar, reabrir → dados presentes; exportar `.sqlite` e abrir no DuckDB do PC.
