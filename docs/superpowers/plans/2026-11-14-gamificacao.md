# Gamificação e refeições (v2): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ordem nova das refeições com Madrugada, dia do app virando às 05:00, camada de jogo calculada (XP, nível, Dia N, conquistas, painel, fechamento de ontem) e visual "Painel de status" preto e violeta em todas as telas.

**Architecture:** Tudo que é jogo são funções puras em `src/calc/` que recebem dias agregados vindos de uma consulta nova em `repos.ts`; nada de jogo é gravado. A tabela `refeicoes` é reconstruída uma vez por migração versionada (`PRAGMA user_version = 2`) dentro de `abrirBanco`, o que cobre também backups importados. As telas só consomem essas funções.

**Tech Stack:** React 19, TypeScript 7, Vite 8, vite-plugin-pwa, sql.js (SQLite WASM) + idb-keyval, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-gamificacao-design.md`

## Global Constraints

- Ordem e nomes das refeições: `cafe` "Café da manhã", `almoco` "Almoço", `lanche` "Lanche da tarde", `jantar` "Jantar", `madrugada` "Madrugada".
- O dia do app vira às **05:00**.
- XP: +10 por dia com pelo menos uma refeição; +5 por tipo de refeição registrado no dia; +15 por dia com treino. O XP nunca cai por resultado.
- Nível *n* começa em `50·n·(n−1)` XP (nível 1 = 0, nível 2 = 100, nível 3 = 300, nível 4 = 600).
- "Dia registrado" é um dia com pelo menos uma refeição.
- Sequência, recorde, média de 7 dias e as conquistas de déficit usam só dias **anteriores a hoje**.
- Nada em vermelho e nenhuma mensagem negativa. "Acima do gasto" usa `--neutro-alto #e0b36a`.
- Tokens de cor: `--fundo #000`, `--bloco #0b0b0e`, `--borda #1e1e24`, `--texto #f2f2f2`, `--suave #8a8a96`, `--acento #c77dff`, `--neutro-alto #e0b36a`. O brilho fica só no número principal, na barra de energia, nos botões + e nas conquistas desbloqueadas.
- Ícones: SVG de linha inline, sem emojis na interface.
- Nenhuma dependência nova de runtime.
- Nenhum registro existente pode se perder na migração.
- Não publicar (push na `main`) antes de o Arthur ver as telas e aprovar.

## Review Focus

1. **Backup antigo importado:** um `.sqlite` da v1 com registros `lanche` precisa abrir migrado, com tudo aparecendo em "Lanche da tarde". Teste na Task 2.
2. **Usar o app entre 00:00 e 04:59:** Hoje, Treino e Histórico tratam o dia anterior como "hoje", e o treino é salvo no dia anterior. Testes nas Tasks 1 e 6.
3. **Usuário novo, sem histórico:** o painel mostra "—" (nunca `NaN`), o Dia N é 1, não aparece fechamento de ontem e nenhuma conquista vem desbloqueada. Testes nas Tasks 3, 4 e 5.
4. **Dia só com treino:** ganha 15 XP, mas não conta em Registros, Dia N nem nas conquistas de dias. Testes nas Tasks 3 e 4.
5. **Consumo acima da meta:** a barra fica cheia, o texto aparece em âmbar com "+X" e não há nenhuma classe ou cor vermelha. Teste na Task 5.

---

### Task 1: Dia do app e regra da Madrugada

**Files:**
- Create: `src/refeicoes.ts`
- Modify: `src/calc/datas.ts`, `src/calc/datas.test.ts`

**Interfaces:**
- Produces:
  - `src/refeicoes.ts`:
    - `export const TIPOS_REFEICAO = ['cafe','almoco','lanche','jantar','madrugada'] as const`
    - `export type TipoRefeicao = typeof TIPOS_REFEICAO[number]`
    - `export const NOMES_REFEICAO: Record<TipoRefeicao, string>`, com os nomes de Global Constraints
  - `src/calc/datas.ts`:
    - `hojeApp(agora?: Date): string`
    - `dataParaRefeicao(tipo: TipoRefeicao, dataTela: string, agora?: Date): string`
    - `diasEntre(de: string, ate: string): number`, a diferença em dias corridos
    - `nomeDiaSemana(data: string): string`, que devolve `'domingo'|'segunda'|'terça'|'quarta'|'quinta'|'sexta'|'sábado'`

- [ ] **Step 1: Escrever os testes que falham** em `datas.test.ts`:
```ts
test('hojeApp antes das 5h é ontem', () => expect(hojeApp(new Date(2026, 10, 15, 2, 0))).toBe('2026-11-14'))
test('hojeApp às 5h vira', () => expect(hojeApp(new Date(2026, 10, 15, 5, 0))).toBe('2026-11-15'))
test('madrugada de manhã vai pro dia anterior', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-15', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-14'))
test('madrugada à tarde fica no dia', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-15', new Date(2026, 10, 15, 12, 0))).toBe('2026-11-15'))
test('madrugada às 2h fica no dia do app', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-14', new Date(2026, 10, 15, 2, 0))).toBe('2026-11-14'))
test('madrugada num dia passado fica no dia da tela', () =>
  expect(dataParaRefeicao('madrugada', '2026-11-10', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-10'))
test('outras refeições não mudam', () =>
  expect(dataParaRefeicao('jantar', '2026-11-15', new Date(2026, 10, 15, 9, 0))).toBe('2026-11-15'))
test('diasEntre', () => { expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3); expect(diasEntre('2026-11-02', '2026-11-02')).toBe(0) })
test('nomeDiaSemana', () => expect(nomeDiaSemana('2026-11-13')).toBe('sexta'))
```
- [ ] **Step 2: Rodar** `npx vitest run src/calc/datas.test.ts`. Esperado: FAIL (funções não existem).
- [ ] **Step 3: Implementar.**
  - `hojeApp`: `hojeLocal(new Date(agora.getTime() - 5 * 3600_000))`.
  - `hojeLocal` e `somarDias` **não mudam**, porque `somarDias` usa `hojeLocal` com datas à meia-noite.
  - `dataParaRefeicao` só desloca quando `tipo === 'madrugada'`, `dataTela === hojeApp(agora)` e a hora local está entre 5 e 11.
  - `diasEntre` usa `Date.UTC` para não sofrer com horário de verão.
- [ ] **Step 4: Rodar** de novo. Esperado: PASS.
- [ ] **Step 5: Commit** `feat: dia do app vira às 5h e regra da madrugada`.

### Task 2: Migração das refeições

**Files:**
- Modify: `src/db/schema.sql.ts` (CHECK de `tipo`), `src/db/banco.ts` (chamar `migrar` em `abrirBanco` depois de `SCHEMA`), `src/db/repos.ts` (`TipoRefeicao` passa a vir de `src/refeicoes.ts`, reexportado)
- Create: `src/db/migracao.ts`, `src/db/migracao.test.ts`

**Interfaces:**
- Consumes: `TIPOS_REFEICAO` (Task 1).
- Produces: `migrar(db: Database): void`. Depois dela, `PRAGMA user_version` vale 2 e `refeicoes` aceita os 5 tipos.

- [ ] **Step 1: Escrever o teste que falha.**
  - O teste monta um banco **v1** com `new SQL.Database()` e o `CREATE TABLE refeicoes` antigo, copiado literalmente no teste com `CHECK (tipo IN ('cafe','almoco','jantar','lanche'))`, junto com `perfil`, `alimentos` e `treinos`.
  - Insere 1 alimento e 4 refeições, uma de cada tipo antigo, e exporta.
  - Casos:
    - `abrirBanco(bytes)` → `refeicoesDoDia` devolve as 4 refeições com os mesmos `id`, `tipo`, `gramas` e `kcal`.
    - `addRefeicao(..., tipo: 'madrugada')` funciona.
    - `PRAGMA user_version` é 2.
    - `abrirBanco(b.exportar())` de novo (rodar duas vezes) mantém 5 registros.
    - Banco novo (`abrirBanco()`) aceita `madrugada` e tem `user_version` 2.
    - Um tipo inválido (`'ceia'`) continua sendo recusado.
- [ ] **Step 2: Rodar** `npx vitest run src/db/migracao.test.ts`. Esperado: FAIL no insert de `madrugada`.
- [ ] **Step 3: Implementar `migrar`.**
  - Se `user_version < 2` e o `sql` de `refeicoes` em `sqlite_master` não contém `'madrugada'`, roda em transação:
    1. `CREATE TABLE refeicoes_nova` com o CHECK novo.
    2. `INSERT INTO refeicoes_nova SELECT id, data, tipo, alimento_id, gramas, kcal FROM refeicoes`.
    3. `DROP TABLE refeicoes`.
    4. `ALTER TABLE refeicoes_nova RENAME TO refeicoes`.
    5. Recria `idx_refeicoes_data`.
  - Em qualquer caso, termina com `PRAGMA user_version = 2`.
  - Em caso de erro, `ROLLBACK` e relança.
- [ ] **Step 4: Rodar** todos os testes (`npx vitest run`). Esperado: PASS, incluindo `repos.test.ts`.
- [ ] **Step 5: Commit** `feat: migração das refeições com madrugada`.

### Task 3: Dias do jogo, XP, nível e Dia N

**Files:**
- Modify: `src/db/repos.ts`, `src/db/repos.test.ts`
- Create: `src/calc/jogo.ts`, `src/calc/jogo.test.ts`

**Interfaces:**
- Consumes: `TipoRefeicao` (Task 1), `diasEntre` (Task 1).
- Produces:
  - `repos.ts`:
    - `interface DiaJogo { data: string; kcalPorTipo: Partial<Record<TipoRefeicao, number>>; consumido: number; treinosKcal: number; qtdTreinos: number }`
    - `diasDoJogo(b: Banco): DiaJogo[]`, com todos os dias que têm refeição ou treino, em ordem crescente de data.
  - `jogo.ts`:
    - `xpDoDia(d: DiaJogo): number`
    - `xpTotal(dias: DiaJogo[]): number`
    - `nivel(xp: number): { nivel: number; xpNoNivel: number; xpDoNivel: number }`, em que `xpDoNivel` é o tamanho do nível atual (100·n)
    - `registrado(d: DiaJogo): boolean`, verdadeiro quando `consumido > 0`
    - `diaN(dias: DiaJogo[], hoje: string): number`

- [ ] **Step 1: Escrever os testes que falham.**
  - `repos.test.ts`, com 2 refeições `almoco` e 1 `jantar` em 11-13 e só um treino em 11-14:
    - `diasDoJogo` devolve `[{data:'2026-11-13', kcalPorTipo:{almoco:256, jantar:128}, consumido:384, treinosKcal:0, qtdTreinos:0}, {data:'2026-11-14', kcalPorTipo:{}, consumido:0, treinosKcal:300, qtdTreinos:1}]`. Use `toMatchObject` e `toBeCloseTo` nas kcal.
  - `jogo.test.ts`, com um helper `dia(data, tipos, treinos=0)`:
    - `xpDoDia` com 3 tipos e sem treino = 25; com 3 tipos e treino = 40; só com treino = 15; vazio = 0.
    - `nivel(0)` = `{nivel:1, xpNoNivel:0, xpDoNivel:100}`; `nivel(99).nivel` = 1; `nivel(100)` = `{nivel:2, xpNoNivel:0, xpDoNivel:200}`; `nivel(600).nivel` = 4.
    - `diaN([], '2026-11-14')` = 1; primeira refeição em 11-10 e hoje 11-14 = 5; um dia só com treino antes da primeira refeição não muda o resultado.
    - Apagar um dia da lista reduz `xpTotal`. Isso confirma que o XP é derivado dos dados.
- [ ] **Step 2: Rodar** os dois arquivos. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - `diasDoJogo` é uma consulta agrupada: `SUM(kcal)` por data e tipo, mais `SUM(kcal)` e `COUNT(*)` de treinos por data. A montagem é feita em TS.
  - `nivel` acha o maior *n* com `50·n·(n−1) ≤ xp`.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat: xp, nível e dia N calculados dos registros`.

### Task 4: Conquistas, painel e fechamento de ontem

**Files:**
- Create: `src/calc/conquistas.ts`, `src/calc/conquistas.test.ts`, `src/calc/painel.ts`, `src/calc/painel.test.ts`

**Interfaces:**
- Consumes: `DiaJogo`, `registrado` (Task 3); `DiaResumo`, `resumirDias`, `streak` de `historico.ts`; `somarDias`, `diasEntre`, `NOMES_REFEICAO`.
- Produces:
  - `type NomeIcone = 'cafe'|'almoco'|'lanche'|'jantar'|'madrugada'|'chama'|'calendario'|'trofeu'|'haltere'|'estrela'|'hoje'|'perfil'`, exportado de `conquistas.ts` e usado pelo componente de ícone na Task 5.
  - `interface Conquista { id: string; nome: string; descricao: string; icone: NomeIcone; progresso: number; meta: number; desbloqueada: boolean }`
  - `conquistas(dias: DiaJogo[], resumos: DiaResumo[], hoje: string): Conquista[]`, que devolve sempre as 9, nesta ordem e com estes ids/metas:
    - `primeiro-registro`/1
    - `dias-7`/7
    - `dias-30`/30
    - `semana-completa`/7 (maior sequência de dias registrados consecutivos)
    - `deficit-3`/3
    - `deficit-7`/7 (recorde de déficit só com dias anteriores a `hoje`)
    - `primeiro-treino`/1
    - `treinos-10`/10 (soma de `qtdTreinos`)
    - `dia-completo`/4 (máximo de tipos distintos entre café, almoço, lanche e jantar num mesmo dia)
  - Em todas, `progresso = min(valor, meta)`.
  - `proximaConquista(cs: Conquista[]): Conquista | null`: a bloqueada com maior `progresso/meta`. Empate fica com a que vem primeiro.
  - `textoFalta(c: Conquista): string`, por exemplo `"faltam 2 dias seguidos registrando"`. O texto exato de cada id fica a critério de quem implementa, mas sempre com o que falta, sem tom de cobrança.
  - `painel(resumos: DiaResumo[], dias: DiaJogo[], hoje: string): { sequencia: number; recorde: number; media7: number | null; ontem: number | null; registros14: number }`. Os valores de déficit são positivos quando há déficit.
  - `fechamentoOntem(dias: DiaJogo[], resumos: DiaResumo[], hoje: string): string | null`

- [ ] **Step 1: Escrever os testes que falham.**
  - Conquistas:
    - Lista vazia → 9 conquistas, nenhuma desbloqueada.
    - 3 dias seguidos em déficit **incluindo hoje** → `deficit-3` bloqueada com progresso 2; os mesmos dias terminando ontem → desbloqueada.
    - Um dia com café, almoço, lanche e jantar → `dia-completo` desbloqueada.
    - Um dia com só madrugada e almoço → progresso 1 em `dia-completo` (madrugada não conta).
    - Dias só com treino não contam em `dias-7`.
    - `proximaConquista` escolhe a de maior fração.
  - Painel:
    - Sem dados → `{sequencia:0, recorde:0, media7:null, ontem:null, registros14:0}`.
    - Hoje em déficit não entra em `sequencia`.
    - `media7` é a média dos últimos 7 dias fechados e registrados.
    - `registros14` conta dias registrados em `[hoje−13, hoje]`, ou seja, 14 dias contando hoje.
  - Fechamento:
    - Sem ontem → `null`.
    - Jantar de ontem 620 contra média 480 nos dias anteriores → `"Ontem: 1.770 kcal, 180 abaixo do gasto. O jantar foi 620 kcal, acima da sua média de 480."` Monte o perfil e as refeições para que os números batam.
    - Nenhuma acima da média → `"… A maior refeição foi o almoço, com 710 kcal."`
    - Ontem acima do gasto → `"… 120 acima do gasto. …"`
    - Primeira madrugada (sem histórico dela) não é comparada.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - Números formatados com `toLocaleString('pt-BR')` e arredondados.
  - Nome da refeição na frase em minúsculas, com artigo ("o jantar", "o café da manhã", "o lanche da tarde", "a madrugada").
  - A média de cada refeição considera os até 7 dias registrados anteriores a ontem em que ela aparece.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat: conquistas, painel e fechamento de ontem`.

### Task 5: Visual base e tela Hoje

**Files:**
- Create: `src/componentes/Icone.tsx`, `src/componentes/BarraEnergia.tsx`
- Delete: `src/componentes/Anel.tsx`
- Modify: `src/index.css` (reescrita com os tokens), `index.html` e `vite.config.ts` (`theme_color` e `background_color` `#000000`), `public/icon-192.png` e `public/icon-512.png` (fundo preto, anel violeta `#c77dff`, sem dependência nova; qualquer método de geração), `src/telas/Hoje.tsx`, `src/telas/Adicionar.tsx` (importa `NOMES_REFEICAO` de `src/refeicoes.ts`), `src/telas/Hoje.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3 e 4.
- Produces:
  - `Icone({ nome: NomeIcone; className?: string })`, um SVG de linha com `stroke="currentColor"` e `aria-hidden`.
  - `BarraEnergia({ consumido: number; meta: number })`, que mantém `data-testid="restante"` com `Math.abs(round(meta − consumido))`. Acima da meta mostra `+X` com a classe `acima` (âmbar).

- [ ] **Step 1: Escrever os testes que falham** em `Hoje.test.tsx`. Os testes atuais continuam, ajustados para o novo layout.
  - **Ordem:** os botões "Adicionar em …" aparecem nesta ordem: Café da manhã, Almoço, Lanche da tarde, Jantar, Madrugada.
  - **Madrugada de manhã:**
    - Prepare com `vi.useFakeTimers({ toFake: ['Date'] })` e `vi.setSystemTime(new Date(2026, 10, 14, 9, 0))`.
    - Ações: clicar em "Adicionar em Madrugada", buscar, escolher e adicionar.
    - Esperado:
      - Aparece o texto `Salvo na madrugada de sexta`.
      - O consumido de hoje continua 0.
      - `refeicoesDoDia(b, '2026-11-13')` tem 1 item.
  - **Painel:**
    - Com o perfil e 1 dia fechado em déficit (ontem, com café e almoço, ou seja, 10 + 5 + 5 = 20 XP), aparecem `data-testid` `sequencia`, `recorde`, `media7`, `ontem`, `registros` e o selo `LV 1 · 20 XP`.
    - Sem histórico, `media7` e `ontem` mostram "—".
  - **Fechamento:** com refeição ontem, o texto começa com "Ontem:". Sem refeição ontem, ele não aparece.
  - **Acima da meta:** o consumo acima da meta mostra `restante` com classe `acima`. Nenhum elemento tem `ruim` nem `vermelho` na classe.
  - **Dia anterior (‹):** o painel (`sequencia`) e o fechamento não aparecem, e a energia e as refeições do dia continuam.
  - **Gasto:** continua visível em `data-testid="gasto"` com o valor bruto arredondado. Atualize `Treino.test.tsx` para usar esse testid.
- [ ] **Step 2: Rodar** `npx vitest run src/telas`. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **Hoje** usa `hojeApp()`. No topo, `DIA N` e o selo `LV n · X XP`. Depois o bloco "Energia restante" com `BarraEnergia`, mais "gasto" e "treino" em texto pequeno.
  - Quando a data na tela é o hoje real, aparecem também a grade do painel, as 3 primeiras conquistas desbloqueadas mais a próxima com `textoFalta`, e o fechamento de ontem.
  - **Refeições** em `TIPOS_REFEICAO`, com `Icone`.
  - **Adicionar** recebe `data` já resolvida por `dataParaRefeicao`. Ao voltar, se a data salva for diferente da data da tela, a Hoje mostra o aviso por cerca de 4 s.
  - **CSS:** só tokens de Global Constraints. `--verde` e `--vermelho` deixam de existir.
- [ ] **Step 4: Rodar** `npx vitest run`. Esperado: tudo PASS.
- [ ] **Step 5: Commit** `feat: painel de status na tela Hoje e visual preto e violeta`.

### Task 6: Histórico, Treino, Perfil e abas

**Files:**
- Modify: `src/telas/Historico.tsx`, `src/telas/Historico.test.tsx`, `src/telas/Treino.tsx`, `src/telas/Perfil.tsx`, `src/App.tsx` (abas com `Icone`), `src/componentes/Calendario.tsx` (sem mudança de lógica, só classes)

**Interfaces:**
- Consumes: `hojeApp`, `conquistas`, `nivel`, `xpTotal`, `diasDoJogo`, `Icone`.

- [ ] **Step 1: Escrever e ajustar os testes.**
  - **Histórico:**
    - Fixar a data com `vi.setSystemTime(new Date(2026, 10, 14, 12, 0))` e usar dias 01–03 do mês. Assim o teste não quebra no início do mês.
    - `recorde` continua 2.
    - Novo teste: hoje em déficit não soma em `streak-atual`.
    - A seção de conquistas lista as 9, com as bloqueadas marcadas por `data-bloqueada="true"`.
  - **Treino:** com `vi.setSystemTime(new Date(2026, 10, 15, 2, 0))`, registrar um treino salva em `2026-11-14`. Confira com `treinosDoDia(b, '2026-11-14')`.
  - **Perfil:** mostra `LV n` e uma barra de XP (`data-testid="xp-barra"`).
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **Histórico:** `streak(dias.filter(d => d.data < hoje), hoje)`. Calendário com dias em déficit em violeta e dias acima em âmbar. Seção "Conquistas" com os ícones.
  - **Treino e Perfil:** usam `hojeApp()`. O Perfil ganha um bloco de nível.
  - **Abas:** ícone e rótulo, com a aba ativa no acento. Os rótulos acessíveis continuam iguais ("Hoje", "Treino", "Histórico", "Perfil").
- [ ] **Step 4: Rodar** `npx vitest run`, `npx oxlint` e `npm run build`. Esperado: tudo verde.
- [ ] **Step 5: Commit** `feat: visual e jogo no histórico, treino, perfil e abas`.

### Task 7: Conferência visual e aprovação

- [ ] **Step 1:** `npm run build` e `npx vite preview --port 4173`. Abrir `http://localhost:4173/app-calorias/` no navegador em tamanho de celular (375×812).
- [ ] **Step 2:** Criar um perfil e registrar alguns dias de teste, incluindo um acima do gasto e uma Madrugada. Capturar as telas Hoje, Adicionar, Histórico, Treino e Perfil, e conferir que não há vermelho, emoji nem `NaN`.
- [ ] **Step 3:** Mostrar as capturas ao Arthur e esperar a aprovação. **Sem push antes disso.**
- [ ] **Step 4:** Depois do ok: `git push`, acompanhar o workflow com `gh run watch` e abrir o site publicado para conferir.
