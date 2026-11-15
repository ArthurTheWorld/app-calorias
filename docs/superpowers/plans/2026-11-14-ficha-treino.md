# Ficha de treino Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ficha de treino (divisões, marcar feito, carga de hoje e da última vez) no topo da aba Treino, pronta para receber o treino real depois.

**Architecture:** Ficha estática em `src/treino/ficha.ts` (vazia por enquanto). Registros em `exercicios_feitos` (banco v6, tabela via SCHEMA). Componente `FichaTreino` recebe a ficha por prop; `Treino` passa `FICHA` e esconde a seção se vazia.

**Tech Stack:** React 19, TypeScript, sql.js, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-ficha-treino-design.md`

## Global Constraints
- Nada de vermelho, aviso de treino pulado ou cobrança.
- Dia do app via `useHojeApp()` (vira às 05:00).
- Carga: vírgula aceita, 0 < carga ≤ 500; inválida não grava.
- Registrar exercício não lança kcal.

## Review Focus
- Ficha trocada: exercício novo sem histórico não mostra "última"; divisão salva que não existe mais na ficha abre na primeira.
- Carga apagada do campo: exercício continua marcado, carga vira null.
- Mesmo exercício em duas divisões compartilha o histórico ("última" por nome).
- Virada do dia com a aba aberta: "hoje" fica vazio e "última" passa a mostrar a carga de ontem.
- Muitas teclas seguidas no campo de carga: o valor final gravado é o último digitado.

---

### Task 1: Banco v6 e repositório

**Files:** Modify `src/db/schema.sql.ts`, `src/db/migracao.ts`, `src/db/repos.ts`, `src/exportar.ts`; Test `src/db/treino.test.ts`, ajustar `migracao.test.ts` (5→6) e `exportar.test.ts` se listar tabelas.

**Interfaces — Produces:**
- `interface ExercicioFeito { exercicio: string; divisao: string; cargaKg: number | null }`
- `exerciciosDoDia(b, data): ExercicioFeito[]`
- `marcarExercicio(b, {data, divisao, exercicio, cargaKg?: number | null}): Promise<void>` — upsert por (data, exercicio); só sobrescreve carga se `cargaKg !== undefined`.
- `desmarcarExercicio(b, data, exercicio): Promise<void>`
- `ultimaCarga(b, exercicio, antesDe): number | null` — data < antesDe, carga não nula, mais recente.
- `ultimaDivisao(b): string | null` — divisão do registro mais recente (data DESC, id DESC).

- [ ] Testes: marcar/desmarcar; upsert sem carga preserva carga; carga null limpa; `ultimaCarga` ignora hoje e nulls e pega a mais recente; `ultimaDivisao`; migração v5→v6 cria a tabela; `TABELAS` inclui `exercicios_feitos`.
- [ ] Ver falhar, implementar, ver passar, suíte toda, commit.

### Task 2: FichaTreino na aba Treino

**Files:** Create `src/treino/ficha.ts`, `src/telas/FichaTreino.tsx`, `src/telas/FichaTreino.test.tsx`; Modify `src/telas/Treino.tsx`, `src/index.css`.

**Interfaces — Produces:**
- `interface ExercicioFicha { nome: string; series: number; reps: string; obs?: string }`
- `interface Divisao { nome: string; titulo?: string; exercicios: ExercicioFicha[] }`
- `export const FICHA: Divisao[] = []`
- `FichaTreino({ ficha, data }: { ficha: Divisao[]; data: string })`
- `divisaoInicial(ficha, hoje: ExercicioFeito[], ultima: string | null): string` — divisão de hoje se houver registro; senão a seguinte à `ultima` (circular); senão a primeira.

UI: radiogroup "Divisão" com chips (`.porcoes` reaproveitado); por exercício um checkbox com label do nome, texto "`series` × `reps`", input `aria-label="Carga de <nome> (kg)"`, e "última: X kg" (pt-BR). Ficha vazia → `Treino` não renderiza a seção.

- [ ] Testes: ficha vazia não mostra "Divisão"; abre na divisão após a última; marcar grava; desmarcar apaga; digitar "32,5" grava 32.5 e marca; carga inválida não grava; apagar carga mantém marcado com null; mostra "última: 30 kg" de dia anterior.
- [ ] Ver falhar, implementar, ver passar, suíte toda, tsc, commit.
