# Editor de ficha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** O usuário monta e edita a ficha de treino pelo app.
**Spec:** `docs/superpowers/specs/2026-11-14-ficha-treino-design.md` (seção "Mudança em 2026-11-15").

## Review Focus
- Renomear exercício para um nome que já tem registro no mesmo dia (UNIQUE(data, exercicio)).
- Remover a divisão aberta / a divisão de hoje; ficha volta a ficar vazia.
- Backup antigo (v5/v6) importado: tabelas novas vazias, nada quebra.
- Campos inválidos (séries 0, "abc", nome vazio) não gravam e não travam o formulário.
- Exclusão sem depender de `PRAGMA foreign_keys` (apagar exercícios explicitamente).

### Task 1: banco v7 + `src/db/ficha.ts`
Produces: `lerFicha(b): Divisao[]`, `adicionarDivisao(b): Promise<number>`, `editarDivisao(b, id, {nome, titulo}): Promise<boolean>`, `removerDivisao(b, id)`, `adicionarExercicio(b, divisaoId, dados): Promise<boolean>`, `editarExercicio(b, id, dados): Promise<boolean>`, `removerExercicio(b, id)`, `moverExercicio(b, id, -1|1)`. Tipos `Divisao`/`ExercicioFicha` (com `id`) em `src/treino/ficha.ts`; `FICHA` some.
Tests: `src/db/ficha.test.ts`, migração v6→v7, exportação.

### Task 2: telas
`src/telas/EditarFicha.tsx` + teste; `Treino.tsx` lê `lerFicha`, mostra "Montar ficha"/"Editar ficha"; `FichaTreino` com fixtures com `id`.
