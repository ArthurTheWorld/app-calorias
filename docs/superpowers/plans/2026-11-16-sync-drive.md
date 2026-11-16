# Sincronização com o Drive: plano de implementação

> Execução inline (superpowers:executing-plans), TDD em cada tarefa, revisão final por um revisor novo.

**Objetivo:** o app guarda o banco num arquivo do Google Drive e pega a versão nova sozinho, conforme a spec.
**Spec:** `docs/superpowers/specs/2026-11-16-sync-drive-design.md`
**Stack:** React 19, sql.js, idb-keyval, Vitest com fake-indexeddb, Google Identity Services (script externo), Drive REST v3 via `fetch`.

## Restrições globais

- Escopo `https://www.googleapis.com/auth/drive.file`. Pasta `App Calorias`, arquivo `app-calorias.sqlite`.
- Client ID vazio → nada de Drive aparece; o resto do app igual.
- Mensagens neutras, nada vermelho.
- Arquivos em LF.

## Foco da revisão

1. Gravação durante um envio não pode ser marcada como sincronizada.
2. Baixar um arquivo inválido do Drive não pode substituir o banco local.
3. Token vencido nunca dispara popup sem toque.
4. Conflito nunca resolve sozinho.
5. Falha de rede deixa o estado como estava (tenta de novo depois).

## Tarefas

### 1. Contador de gravações e estado da sincronização
- `src/db/banco.ts`: `salvar()` também incrementa `seq-local` no IDB. Exporta `lerSeqLocal(): Promise<number>`.
- `src/sync/estado.ts`: `interface EstadoSync { fileId: string | null; versaoRemota: string | null; seqSincronizado: number; ultima: string | null }`, `lerEstadoSync()`, `gravarEstadoSync(parcial)`, `limparEstadoSync()`.
- Testes: salvar duas vezes → seq 2; estado padrão e gravação parcial.

### 2. Decisão pura
- `src/sync/decidir.ts`: `decidir({ remoto: { version } | null, estado, seqLocal }): 'criar' | 'baixar' | 'enviar' | 'conflito' | 'nada'`.
- Testes com os cinco casos.

### 3. Cliente Drive
- `src/sync/drive.ts`: `interface ClienteDrive { procurar(): Promise<{ id, version } | null>; meta(id): Promise<{ id, version } | null>; baixar(id): Promise<Uint8Array>; criar(dados): Promise<{ id, version }>; atualizar(id, dados): Promise<{ id, version }> }` e `clienteDrive(token)` com `fetch`. `criar` cria a pasta se preciso. `meta` devolve null para 404 ou lixeira.
- Testes com `fetch` falso: URLs, cabeçalho Authorization, 404 → null, erro HTTP → exceção.

### 4. Motor
- `src/sync/motor.ts`: `sincronizar(banco, cliente, opcoes?: { resolver?: 'drive' | 'celular' }): Promise<Resultado>`, com `Resultado = { tipo: 'criado' | 'enviado' | 'baixado' | 'conflito' | 'nada' }`. No 'baixado', grava os bytes validados no IDB e devolve; quem chama recarrega.
- Testes com Drive falso em memória: primeira vez cria; envio marca o seq lido antes; gravação no meio do envio fica pendente; remoto novo e local limpo baixa; ambos → conflito sem mexer; resolver 'drive' baixa, 'celular' envia; arquivo inválido → erro sem substituir; arquivo sumiu → recria.

### 5. Login Google
- `src/sync/config.ts`: `CLIENT_ID = ''`.
- `src/sync/google.ts`: `tokenValido(): string | null` (localStorage, margem de 1 min), `pedirToken(prompt: '' | 'consent'): Promise<string>` (carrega o script GIS uma vez), `esquecerToken()`.
- Testes de `tokenValido` (vencido, válido, ausente).

### 6. Tela
- `src/sync/useSync.tsx`: `ProvedorSync` dentro do `ProvedorBanco`. Ao abrir, se conectado e com token, sincroniza; depois de cada mudança (`versao`), espera 4 s e sincroniza se houver token. Expõe `{ conectado, precisaToque, conflito, ultima, msg, conectar(), sincronizarAgora(), resolver(lado), desconectar() }`. Usa um `ClienteDrive` injetável (testes).
- `src/componentes/FaixaSync.tsx`: no topo; "Drive: toque para sincronizar" ou a pergunta do conflito; mostra a mensagem "Atualizado com a versão do Drive" depois de recarregar.
- `Perfil.tsx`: cartão "Backup e sincronização" (sem CSV; "Baixar backup (.sqlite)", "Restaurar backup"; bloco do Drive só com `CLIENT_ID`).
- Testes de tela com cliente falso e token falso.
