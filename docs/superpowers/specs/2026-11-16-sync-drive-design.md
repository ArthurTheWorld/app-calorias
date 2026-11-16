# Sincronização com o Google Drive

Aprovado pelo Arthur em 2026-11-16 ("vamos na 1", "pode seguir").

## Por quê

Hoje, para o Claude mexer nos dados (cadastrar a ficha, analisar a semana), o Arthur exporta arquivos, passa para o PC e importa de volta. Ele quer parar com esse vai e vem: o app guarda o banco no Drive sozinho, o Claude lê e altera o mesmo arquivo pelo PC, e o app pega a versão nova sozinho.

## Objetivos

- Um arquivo só no Drive: `Meu Drive/App Calorias/app-calorias.sqlite`.
- Com acesso válido, o app sobe o banco alguns segundos depois de cada gravação e confere o Drive ao abrir.
- Versão nova no Drive sem mudança no celular: o app troca o banco sozinho e avisa "Atualizado com a versão do Drive".
- Os dois lados mudaram: o app pergunta ("Usar a versão do Drive" / "Manter a do celular"). Nunca apaga calado.
- Perfil simplificado: sai "Exportar CSVs"; ficam "Baixar backup (.sqlite)" e "Restaurar backup" como reserva.

## Não objetivos

- Sem servidor próprio, sem Firebase/Supabase, sem sincronização registro a registro.
- Sem mesclar dados: a unidade é o arquivo inteiro.
- Sem uso em vários celulares ao mesmo tempo (funciona, mas não é foco).

## Restrições

- PWA estático no GitHub Pages. Login pelo Google Identity Services (modelo de token, escopo `drive.file`). O token vale 1 hora e só renova com um toque (o Google exige gesto). Isso foi explicado e aceito.
- Client ID público fica em `src/sync/config.ts`. Vazio = recurso escondido (o app funciona como hoje).
- O lado do PC grava pelo Google Drive para computador (`G:`), sobrescrevendo o arquivo **no lugar**, para manter o mesmo id no Drive (o escopo `drive.file` só enxerga arquivos criados pelo app).
- Monitoramento sem cobrança: nada vermelho; o aviso de toque é discreto.

## Abordagens consideradas

1. **App conectado ao Drive (escolhida).** Usa o Drive que ele já tem, sem infraestrutura nova; custo: credencial no Google Cloud uma vez e um toque por hora.
2. Banco na nuvem (Firebase/Supabase): tempo real, mas infraestrutura e dados em terceiros; exagero para app pessoal.
3. Botão de compartilhar: continua sendo passar arquivo. Descartada.

## Desenho

- **Contador local de gravações.** `Banco.salvar()` incrementa um contador no IndexedDB. O estado da sincronização guarda `fileId`, `versaoRemota` (campo `version` do Drive) e `seqSincronizado`. "Celular mudou" = contador > `seqSincronizado`. O contador é lido antes do envio; gravações durante o envio continuam pendentes.
- **Decisão (função pura):** sem arquivo remoto → criar; remoto mudou e local não → baixar; ambos mudaram → perguntar; só local mudou → enviar; nada → nada.
- **Baixar:** valida com `validarBancoImportado`, grava no IndexedDB, marca sincronizado e recarrega a página (como o importar faz). Depois do recarregamento aparece "Atualizado com a versão do Drive".
- **Cliente Drive:** `fetch` na API REST v3 (procurar pasta/arquivo, criar com upload multipart, atualizar com `uploadType=media`, metadados `id,version`, baixar com `alt=media`). Interface própria para os testes usarem um Drive falso.
- **Token:** guardado com a validade no `localStorage`; considerado vencido 1 minuto antes.
- **Tela:**
  - Perfil, cartão "Backup e sincronização": "Conectar Google Drive" ou a linha "Drive conectado · última sincronização HH:MM", "Sincronizar agora", "Baixar backup (.sqlite)", "Restaurar backup".
  - Topo do app: faixa discreta "Drive: toque para sincronizar" quando conectado e o token venceu; a pergunta de conflito também aparece ali.
- **Erros:** falha de rede ou da API vira "Não deu para sincronizar agora. Tente de novo mais tarde." (neutro), sem perder dados locais.

## Fica com o implementador

Nomes internos, intervalo exato de espera após gravar (alguns segundos), texto fino das mensagens dentro do tom acima.
