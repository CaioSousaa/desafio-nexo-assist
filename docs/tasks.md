# Tasks: Nexo Assist — agent do service desk de TI

**Entrada**: `prd.md`, `tech-spec.md` | **Card**: Desafio Técnico "Nexo Assist" (PDF v5) | **Base**: `main` (repositório a iniciar em T001) | **Data**: 2026-10-26
**Escopo desta rodada**: todas as histórias (US1–US12), deploy fora (ver X1, X2)

Formato: `- [ ] T### [P] [USn] ação` + Arquivos, Padrão a imitar, Cobre, Verificação.
`[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência pendente).

Convenções desta rodada:

- Repositório vazio: "Padrão a imitar" aponta para a seção da `tech-spec.md` ou para a task anterior que fixou o padrão.
- Migrations são geradas pelo `drizzle-kit` e aplicadas automaticamente só em bancos locais (`data/*.db`) ou temporários de teste; nunca em ambiente compartilhado.
- Testes de integração usam `mkdtemp` + migrations reais (`tech-spec.md` § Estratégia de testes).
- Textos de interface são os literais da `tech-spec.md` § UI; não reescrever.
- Nenhuma task altera teste já criado por task anterior sem dizer "(alterar)" e o motivo.

## Achados da análise

| # | Severidade | Onde | Achado | Resolução |
|---|------------|------|--------|-----------|
| 1 | MÉDIO | tech-spec.md § Gate de regras e § Dados / § Arquivos (`package.json`) | Gate e Dados citam `npm run setup`, mas a lista de scripts do `package.json` não tem `setup`; o `startup.ts` já migra e semeia na subida | Aceito sem editar a spec: os 3 comandos do README são `cp .env.example .env`, `npm install`, `npm run dev`; `db:reset` continua para FR-105 (T021, T075). Furo desse tipo vira README que não roda. |
| 2 | MÉDIO | tech-spec.md § Agent (bloco dinâmico "o funcionário está editando o rascunho D-381") vs § Contratos (`POST /api/chat/messages` sem flag) | A dica de edição no prompt não tem origem no contrato | Aceito: a dica passa a ser derivada do rascunho pendente ("há rascunho pendente D-381; se a mensagem pedir mudança, refaça com `propose_draft`"), sem flag do cliente (T048). Dado que não chega pelo contrato vira prompt mentiroso. |
| 3 | MÉDIO | prd.md § Casos de borda ("analista assume enquanto o agent gera resposta") vs tech-spec.md § Agent passo 8 | Pós-ações não dizem que releem o estado da conversa | Aceito: `post-actions.ts` relê o estado antes de agir e não transfere nem encerra se a conversa já saiu de `com_agent` (T034). Corrida assim vira "transferida" por cima de "assumida". |
| 4 | MÉDIO | prd.md § Casos de borda ("volta ao agent com 30") vs tech-spec.md § Agent passo 2 ("`limit_reached` → 409") | Contador em 30 sem `limit_reached` (transferida no limite e devolvida) não está tratado | Aceito: `runTurn` checa `agent_message_count >= AGENT_MESSAGE_LIMIT` antes do modelo e emite a mensagem de limite em vez de 409 (T067). Limite checado em um ponto só é limite furado. |
| 5 | BAIXO | tech-spec.md § Agent (enum de `action` com 9 valores) vs prd.md FR-012 (8 ações) | "propor atualização ou reabertura" virou dois valores | Aceito: mapeamento 1:1 documentado na suíte (`eval/types.ts`). |
| 6 | BAIXO | prd.md § Premissas ("Transferida para o service desk") vs protótipo ("Suporte N2") | Já resolvido no PRD; a spec segue o PRD | Nenhuma ação. |

Sem achados CRÍTICOS ou ALTOS: cobertura FR → desenho → teste fechada (57/57), nenhum item de "Fora de escopo" no desenho, decisões D1–D9 refletidas (D1 em `proxy.ts`/`users.role`; D2 em `limit.ts`; D3 em `DecisionDetails`; D4/D5 em `post-actions.ts`/`drafts/service.ts`; D6 em `propose_draft`; D7 em `ProfilePage`; D8 em `seed/conversations.ts`; D9 em `close_as_resolved`), nenhum arquivo fora da lista.

## Fase 1 — Fundação (bloqueia as histórias)

- [ ] T001 Iniciar o repositório git e excluir os documentos de trabalho dos commits
  - Arquivos: `.gitignore` (criar: `node_modules`, `.next`, `data/`, `.env`, `*.tsbuildinfo`)
  - Padrão a imitar: `tech-spec.md` § Premissas técnicas (prd/tech-spec fora do commit)
  - Cobre: RN-011 (chaves fora do código)
  - Verificação: `git init -b main && printf 'prd.md\ntech-spec.md\ntasks.md\n' >> .git/info/exclude && git status --short` não lista `prd.md`, `tech-spec.md`, `tasks.md`
- [ ] T002 Criar o projeto Next.js 16 com TypeScript estrito, Tailwind v4, ESLint, Prettier e Vitest, e instalar as dependências decididas
  - Arquivos: `package.json` (criar: scripts `dev`, `build`, `start`, `lint`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `eval` = `tsx eval/run.ts`, `db:reset` = `tsx scripts/db-reset.ts`, `cost-report` = `tsx scripts/cost-report.ts`, `format`; deps `next@16.4.x`, `react@19.3.x`, `react-dom`, `@mastra/core@1.79.x`, `zod@4.6.x`, `drizzle-orm@0.45.x`, `@libsql/client@0.18.x`, `lucide-react@1.61.x`; dev `typescript@^5.9` (7.0 só se `next build` e `drizzle-kit` aceitarem), `drizzle-kit@0.31.x`, `vitest@5.0.x`, `tsx`, `prettier`, `tailwindcss@4.3.x`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`), `next.config.ts` (criar: `serverExternalPackages: ['@mastra/core', '@libsql/client']`), `tsconfig.json` (criar: `strict`, `noUncheckedIndexedAccess`, `paths { "@/*": ["./src/*"] }`), `eslint.config.mjs` (criar: `next/core-web-vitals` + `no-restricted-imports` bloqueando `**/server/tickets/db` fora de `src/server/tickets/**`), `.prettierrc` (criar), `vitest.config.ts` (criar: `environment: 'node'`, `include: ['src/**/*.test.ts']`, alias `@/`), `src/app/layout.tsx` (criar: casca com `lang="pt-BR"`), `src/app/globals.css` (criar: `@import "tailwindcss";`), `src/app/page.tsx` (criar: placeholder "Nexo Assist")
  - Padrão a imitar: `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`; `tech-spec.md` § Arquitetura e § Decisões T3, T7, T8
  - Cobre: requisito técnico "TypeScript estrito" (Gate de regras)
  - Verificação: `npm run typecheck && npm run lint && npm run build`
- [ ] T003 [P] Validar variáveis de ambiente e publicar o `.env.example`
  - Arquivos: `src/env.ts` (criar: zod sobre `process.env`; `GEMINI_API_KEY` obrigatória, `GEMINI_MODEL` padrão `gemini-3.5-flash-lite`, `SESSION_SECRET` obrigatória, `AGENT_CONFIDENCE_THRESHOLD` 60, `AGENT_MESSAGE_LIMIT` 30, `TICKETS_OUTAGE_RATE` 0.1, `TICKETS_OUTAGE_SECONDS` 4, `APP_DB_PATH` `./data/app.db`, `TICKETS_DB_PATH` `./data/tickets.db`, `EVAL_DELAY_MS` 4000; erro legível listando a variável faltante), `.env.example` (criar com exatamente essas chaves e valores padrão, sem segredo)
  - Padrão a imitar: `tech-spec.md` § Arquivos (`.env.example`); `/home/caio/Documentos/dev/sendEmailJobs/backend/src/config/env.validation.ts` (mesmos nomes `GEMINI_API_KEY`/`GEMINI_MODEL`)
  - Cobre: RN-011, SC-007
  - Verificação: `GEMINI_API_KEY=x SESSION_SECRET=y npx tsx -e "import('./src/env.ts').then(m=>console.log(m.env.GEMINI_MODEL))"` imprime `gemini-3.5-flash-lite`; sem `GEMINI_API_KEY` falha citando o nome
- [ ] T004 [P] Criar o logger JSON do servidor
  - Arquivos: `src/server/logger.ts` (criar: `logger.info/warn/error(event, fields)`, uma linha JSON por chamada, `child({ conversationId })`)
  - Padrão a imitar: `tech-spec.md` § Observabilidade (lista de eventos)
  - Cobre: FR-026 (passo falho registrado), Gate "tratamento de erros"
  - Verificação: `npx tsx -e "import('./src/server/logger.ts').then(m=>m.logger.info('turn_started',{conversationId:'c1'}))"` imprime JSON com `event` e `conversationId`
- [ ] T005 Definir o schema Drizzle do banco `app` e gerar a migration inicial
  - Arquivos: `src/server/db/schema.ts` (criar: tabelas `users`, `conversations`, `messages`, `agent_decisions`, `drafts`, `conversation_reads` com as colunas e índices da `tech-spec.md` § Dados, inclusive índice único parcial `employee_id WHERE state != 'encerrada'` e `conversation_id WHERE status = 'aguardando_confirmacao'`), `drizzle.config.app.ts` (criar), `drizzle/app/0000_init.sql` (gerar)
  - Padrão a imitar: `tech-spec.md` § Dados (banco `app`)
  - Cobre: FR-028, FR-080, FR-025, FR-070
  - Verificação: `npx drizzle-kit generate --config drizzle.config.app.ts && grep -c 'CREATE TABLE' drizzle/app/0000_init.sql` imprime `6` e `grep -c 'CREATE UNIQUE INDEX' drizzle/app/0000_init.sql` ≥ 3
- [ ] T006 [P] Definir o schema Drizzle do banco `tickets` e gerar a migration inicial
  - Arquivos: `src/server/tickets/schema.ts` (criar: `tickets`, `ticket_events`, `counters`, `idempotency_keys`), `drizzle.config.tickets.ts` (criar), `drizzle/tickets/0000_init.sql` (gerar)
  - Padrão a imitar: T005; `tech-spec.md` § Dados (banco `tickets`)
  - Cobre: FR-100, FR-026
  - Verificação: `npx drizzle-kit generate --config drizzle.config.tickets.ts && grep -c 'CREATE TABLE' drizzle/tickets/0000_init.sql` imprime `4`
- [ ] T007 Criar os clientes de banco e o migrador dos dois bancos
  - Arquivos: `src/server/db/client.ts` (criar: `createAppDb(path)` com `@libsql/client` + Drizzle, `PRAGMA journal_mode=WAL`, `busy_timeout=5000`), `src/server/tickets/db.ts` (criar: `createTicketsDb(path)`, mesmo padrão; importável só dentro de `src/server/tickets/`), `src/server/db/migrate.ts` (criar: `migrateAll({ appPath, ticketsPath })` com `drizzle-orm/libsql/migrator` apontando para `drizzle/app` e `drizzle/tickets`)
  - Padrão a imitar: `tech-spec.md` § Dados (motor) e § Decisões T5
  - Cobre: FR-080 | Depende de: T005, T006
  - Verificação: `D=$(mktemp -d) && APP_DB_PATH=$D/app.db TICKETS_DB_PATH=$D/tickets.db npx tsx -e "import('./src/server/db/migrate.ts').then(m=>m.migrateAll())" && sqlite3 $D/app.db .tables && sqlite3 $D/tickets.db .tables` lista as 6 e as 4 tabelas; `npm run lint` acusa importação de `tickets/db` fora do módulo (teste manual: importar em `src/server/logger.ts`, ver erro, reverter)
- [ ] T008 [P] Escrever os testes das regras do service desk (falham antes do código)
  - Arquivos: `src/server/rules/priority.test.ts` (criar: tabela completa do Anexo A — INC `impact=equipe|empresa` + `blocksWork` → Crítica; `blocksWork` ou `sameDayCommitment` → Alta; `hasWorkaround` → Média; REQ sem urgência → Baixa; `impact=desconhecido` → trata como `somente_voce`), `src/server/rules/sla.test.ts` (criar: Crítica 1 h corrida; Alta 4 h úteis; Média 3 dias úteis; Baixa 5 dias úteis; `isOverdue(lastUpdate, priority, now)` inclusivo no limite; mesmo resultado para chat e console), `src/server/rules/business-hours.test.ts` (criar: sexta 17:00 + 4 h úteis → segunda 11:00; sábado → próxima segunda 08:00; 18:00 → 08:00 do dia seguinte; fuso America/Sao_Paulo com entrada em UTC), `src/server/rules/reopen-window.test.ts` (criar: resolvido há exatamente 7 dias reabre; 7 dias + 1 min não)
  - Padrão a imitar: `tech-spec.md` § Estratégia de testes (linhas FR-017/FR-018)
  - Cobre: FR-017, FR-018, FR-021, FR-103
  - Verificação: `npx vitest run src/server/rules` falha por asserção/módulo ausente, não por sintaxe
- [ ] T009 Implementar catálogo e regras puras
  - Arquivos: `src/server/rules/catalog.ts` (criar: enums `TicketKind` INC/REQ, `Category` Acesso | Rede e VPN | Hardware | Software | E-mail | Outros, `Priority` Crítica/Alta/Média/Baixa, `TicketStatus` aberto/em_andamento/aguardando_analista/em_atendimento/aprovado/resolvido, `Affected` somente_voce/equipe/empresa, rótulos pt-BR), `src/server/rules/priority.ts` (criar: `classifyPriority(input) → { priority, rule }`), `src/server/rules/business-hours.ts` (criar: `addBusinessHours`, `addBusinessDays`, seg–sex 08:00–18:00 America/Sao_Paulo via `Intl.DateTimeFormat`, sem feriados), `src/server/rules/sla.ts` (criar: `deadlineFor(priority, from)`, `isOverdue`, `overdueText` "há 5 dias"), `src/server/rules/reopen-window.ts` (criar: `canReopen(resolvedAt, now)` janela de 7 dias inclusiva)
  - Padrão a imitar: `tech-spec.md` § Lógica (linhas "Prioridade e prazo", "Duplicidade e reabertura") e § Decisões T9
  - Cobre: FR-017, FR-018, FR-021, FR-103 | Depende de: T008
  - Verificação: `npx vitest run src/server/rules` passa
- [ ] T010 [P] Escrever os testes do módulo de chamados (falham antes do código)
  - Arquivos: `src/server/tickets/local-service.test.ts` (criar: `create` numera `INC-`/`REQ-` sequencial; `listByRequester` não devolve chamado de outro e-mail; `get(number, { requesterEmail })` de outro → `null`; `addNote` registra evento `nota` com autor "via Nexo Assist" e muda prioridade quando pedido; `reopen` volta a `aberto` com evento `reaberto`; `registerTransfer` e `setStatus('em_atendimento')` geram eventos; mesma `idempotencyKey` devolve o mesmo chamado sem duplicar; com `TICKETS_OUTAGE_RATE=1` toda operação lança `TicketServiceUnavailableError` por `TICKETS_OUTAGE_SECONDS`; com `0` nunca), `src/server/tickets/with-retry.test.ts` (criar: 3 tentativas com atrasos 500/1500/3000 ms usando relógio falso; resultado traz `attempts`; sucesso na 2ª tentativa; falha persistente relança)
  - Padrão a imitar: `tech-spec.md` § Contratos (`TicketService`) e § Lógica ("Simulação de indisponibilidade")
  - Cobre: FR-100, FR-102, FR-026, FR-003
  - Verificação: `npx vitest run src/server/tickets` falha por asserção
- [ ] T011 Implementar o módulo de chamados
  - Arquivos: `src/server/tickets/types.ts` (criar: zod `Ticket`, `TicketEvent`, `CreateTicketInput`), `src/server/tickets/errors.ts` (criar: `TicketServiceUnavailableError`, `TicketNotFoundError`, `IdempotencyConflictError`), `src/server/tickets/service.ts` (criar: interface `TicketService` com `listByRequester`, `get`, `getWithEvents`, `create`, `addNote`, `reopen`, `registerTransfer`, `setStatus`), `src/server/tickets/outage.ts` (criar: `OutageSimulator(rate, seconds, random)`), `src/server/tickets/local-service.ts` (criar: `LocalTicketService` sobre `tickets/db.ts`, transações para numeração e idempotência), `src/server/tickets/with-retry.ts` (criar: `withRetry(service, { delays: [500, 1500, 3000], sleep })` devolvendo `attempts`), `src/server/tickets/index.ts` (criar: `getTicketService()` singleton em `globalThis` = `withRetry(new LocalTicketService(...))`)
  - Padrão a imitar: `tech-spec.md` § Decisões T4; § Lógica ("Acesso ao serviço de chamados com retry")
  - Cobre: FR-100, FR-102, FR-026, FR-003 | Depende de: T007, T010
  - Verificação: `npx vitest run src/server/tickets` passa
- [ ] T012 [P] Escrever o teste da busca na central de ajuda (falha antes do código)
  - Arquivos: `src/server/help-center/search.test.ts` (criar: "até que horas o suporte atende" → artigo "Horário do service desk" em 1º; "erro 809" → artigo da VPN com `appliesToEmployee=false` para `device_os=Windows 11` e `true` para `Windows 10`; busca sem acento encontra "VPN não conecta"; no máximo 3 resultados; consulta sem correspondência → lista vazia)
  - Padrão a imitar: `tech-spec.md` § Decisões T11
  - Cobre: FR-013
  - Verificação: `npx vitest run src/server/help-center` falha por asserção
- [ ] T013 Implementar artigos e busca da central de ajuda
  - Arquivos: `src/server/help-center/articles.ts` (criar: 8 artigos `{ id, title, body, category, conditions?: { os?: string[] }, keywords[] }`, incluindo literalmente "VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado." e "Horário do service desk: de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas."), `src/server/help-center/search.ts` (criar: normalização sem acento/caixa, pontuação título ×3, palavras-chave ×2, corpo ×1, `appliesToEmployee` por SO, top 3)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Busca na central de ajuda")
  - Cobre: FR-013, FR-101 | Depende de: T012
  - Verificação: `npx vitest run src/server/help-center` passa
- [ ] T014 [P] Escrever os testes de sessão e autenticação (falham antes do código)
  - Arquivos: `src/server/auth/session.test.ts` (criar: `authenticate(email, password)` → usuário dos dados de exemplo com qualquer senha não vazia; e-mail desconhecido → `{ error: 'email_not_found' }`; senha vazia → `invalid_input`; `signSession`/`verifySession` com `SESSION_SECRET`: válido, expirado, adulterado (um byte) → inválido; `remember=true` → `exp` 30 dias, `false` → sem `Max-Age`; `role` preservado)
  - Padrão a imitar: `tech-spec.md` § Decisões T10
  - Cobre: FR-001, FR-002, FR-004, FR-005
  - Verificação: `npx vitest run src/server/auth` falha por asserção
- [ ] T015 Implementar sessão por cookie HMAC e guardas de rota
  - Arquivos: `src/server/auth/session.ts` (criar: `authenticate`, `signSession`, `verifySession`, `sessionCookie(name='nexo_session', HttpOnly, SameSite=Lax, Path=/)` com `node:crypto` `createHmac('sha256')` + `timingSafeEqual`), `src/server/auth/require.ts` (criar: `requireSession(req)`, `requireEmployee`, `requireAnalyst` → lançam `HttpError(401|403)`)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Autenticação por e-mail")
  - Cobre: FR-001, FR-002, FR-004, FR-005 | Depende de: T014, T007
  - Verificação: `npx vitest run src/server/auth` passa
- [ ] T016 [P] Escrever o teste dos schemas de entrada HTTP (falha antes do código)
  - Arquivos: `src/server/http/schemas.test.ts` (criar: `messageInput` aceita 1–2000 caracteres e `clientMessageId` uuid; rejeita vazio, 2001 caracteres e sem id; `loginInput` exige e-mail válido e senha não vazia; `consoleListQuery` aceita `filter` em `todas|para_voce|com_agent|minhas` e `q` opcional)
  - Padrão a imitar: `tech-spec.md` § Contratos
  - Cobre: FR-010, FR-051, FR-052
  - Verificação: `npx vitest run src/server/http` falha por asserção
- [ ] T017 Implementar helpers HTTP, SSE e barramento de eventos
  - Arquivos: `src/server/http/schemas.ts` (criar), `src/server/http/respond.ts` (criar: `ok(data, status)`, `fail(code, message, status)` no formato `{ error: { code, message } }`, `HttpError`, `handle(fn)` que converte exceções e loga), `src/server/events/bus.ts` (criar: `EventBus` com `publish(channel, event)`/`subscribe(channel, fn)`, canais `conversation:<id>` e `console`, `id` incremental por canal, singleton em `globalThis.__nexoBus`), `src/server/http/sse.ts` (criar: `sseResponse(channel, { lastEventId })` → `Response` com `ReadableStream`, cabeçalhos `text/event-stream`, `Cache-Control: no-cache`, `heartbeat` a cada 15 s, cancela assinatura no `abort`)
  - Padrão a imitar: `tech-spec.md` § Decisões T6 e § Contratos (eventos SSE)
  - Cobre: FR-010, FR-011, FR-043, FR-059 | Depende de: T016, T004
  - Verificação: `npx vitest run src/server/http` passa; `npm run typecheck`
- [ ] T018 Criar os repositórios do banco `app`
  - Arquivos: `src/server/conversations/repo.ts` (criar: `findOpenByEmployee`, `findById`, `insert`, `updateState` com cláusulas condicionais, `listForConsole` bruto), `src/server/messages/repo.ts` (criar: `insert` idempotente por `(conversation_id, client_message_id)`, `updateAgentMessage`, `listByConversation`, parse de `parts` com zod `.catch()` para campo ausente/extra), `src/server/decisions/repo.ts` (criar: `insert`, `findByMessageIds`), `src/server/drafts/repo.ts` (criar: `findPending`, `insert`, `setStatus`, `nextDisplayCode` "D-###")
  - Padrão a imitar: `tech-spec.md` § Dados; convenção de repositório fino sem regra de negócio (§ Arquitetura camada 3)
  - Cobre: FR-025, FR-028, FR-030, FR-080, FR-081 | Depende de: T007
  - Verificação: `npm run typecheck`; testes passam nas fases seguintes (T031, T043)
- [ ] T019 [P] Escrever o teste dos dados de exemplo (falha antes do código)
  - Arquivos: `src/server/seed/run.test.ts` (criar: após `seed()` em bancos temporários: 7 funcionários com `department`, `device_model`, `device_os` e 2 analistas N1/N2; `ana.souza@nexo.com.br` sem conversa; INC-20311 de Ana `aguardando_analista`, Média, `updated_at` há 5 dias → vencido; INC-20298 em_andamento; REQ-10442 aprovado; INC-20150 resolvido há 4 dias; INC-19877 e INC-19410 resolvidos há > 7 dias; chamados de outros funcionários; 6 conversas prontas de outros funcionários nos estados `aguardando_atendente` por pedido (com chamado), `aguardando_atendente` por `baixa_confianca` com `transfer_confidence=41`, `com_agent` ×2, `encerrada`/`resolvida_pelo_agent`, `encerrada`/`encerrada_pelo_analista`; toda mensagem de agent com `decision_id` e decisão com `steps` não vazios; `seed()` duas vezes não duplica)
  - Padrão a imitar: `prd.md` FR-101, FR-104 e § Premissas (datas relativas, nomes do protótipo)
  - Cobre: FR-101, FR-104, FR-105
  - Verificação: `npx vitest run src/server/seed` falha por asserção
- [ ] T020 Implementar os dados de exemplo
  - Arquivos: `src/server/seed/users.ts` (criar: Ana Souza [Financeiro, notebook Windows 11], Carla Mendes, Bruno Tavares, Diego Ramos, Elisa Prado, Fábio Nunes, Gabriela Rocha; analistas Rafael Lima N2 e Juliana Costa N1; `password_changed_at` há 42 dias para Ana), `src/server/seed/tickets.ts` (criar: os chamados do T019 com datas relativas a `now`, via `TicketService`), `src/server/seed/conversations.ts` (criar: 6 conversas escritas à mão com mensagens, partes ricas, eventos de sistema e `agent_decisions` completas no formato de `tech-spec.md` § Dados; textos das prévias do protótipo: "Preciso de acesso ao SAP ainda hoje", "Nexo: Vou chamar um analista para isso.", "Nexo: Chamado INC-20519 criado.", "Isso resolveu, obrigado!", "Nexo: A senha do Wi-Fi foi enviada…"), `src/server/seed/run.ts` (criar: `seed({ appDb, ticketService, now })` idempotente por e-mail/número)
  - Padrão a imitar: `tech-spec.md` § Agent (formato de decisão) e § Decisões D8 do PRD
  - Cobre: FR-101, FR-104 | Depende de: T019, T011, T018
  - Verificação: `npx vitest run src/server/seed` passa
- [ ] T021 [P] Criar o comando de recarga dos dados de exemplo
  - Arquivos: `scripts/db-reset.ts` (criar: apaga `APP_DB_PATH`/`TICKETS_DB_PATH` (+ `-wal`/`-shm`), migra, semeia; imprime resumo)
  - Padrão a imitar: `tech-spec.md` § Compatibilidade (h) e § Lógica
  - Cobre: FR-105 | Depende de: T020
  - Verificação: `GEMINI_API_KEY=x SESSION_SECRET=y npm run db:reset && sqlite3 data/app.db 'select count(*) from users'` imprime `9`
- [ ] T022 [P] Escrever o teste da subida do servidor (falha antes do código)
  - Arquivos: `src/server/startup.test.ts` (criar: banco inexistente → migra e semeia; banco com dados → não semeia de novo; mensagem de agent `pending` vira `error` com texto "A resposta foi interrompida. Tente de novo."; roda duas vezes sem erro)
  - Padrão a imitar: `tech-spec.md` § Observabilidade (ordem de subida)
  - Cobre: FR-080, FR-081
  - Verificação: `npx vitest run src/server/startup.test.ts` falha por asserção
- [ ] T023 Implementar a subida do servidor
  - Arquivos: `src/server/startup.ts` (criar: `ensureStarted()` memoizado em `globalThis`, chamado por todas as rotas e páginas servidoras; migra, semeia se `users` vazio, recupera `pending`, loga `startup_recovered_pending`)
  - Padrão a imitar: `tech-spec.md` § Observabilidade
  - Cobre: FR-080, FR-081 | Depende de: T022, T020, T018
  - Verificação: `npx vitest run src/server/startup.test.ts` passa
- [ ] T024 [P] Aplicar os tokens do protótipo e criar a base de interface
  - Arquivos: `src/app/globals.css` (alterar: `@theme` com `--color-paper #FFFFFF`, `--color-desk #F6F7F9`, `--color-ink #1B2431`, `--color-ink-2 #3D4656`, `--color-ink-3 #5B6472`, `--color-rule #E6E8EC`, `--color-cta #0062C4`, `--color-primary #0285F7`, `--color-primary-soft #0285F712`, `--color-primary-text #0069C7`, `--color-success #00BD6C`, `--color-success-soft #00BD6C14`, `--color-success-text #00804A`, `--color-warning #F5A500`, `--color-warning-soft #F5A50018`, `--color-warning-text #946300`, `--color-danger #EE343B`, `--color-danger-soft #EE343B12`, `--color-danger-text #C4161D`, `--color-violet #A37AFF`, `--color-violet-soft #A37AFF16`, `--color-violet-text #6B3FE0`, `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`, `--font-ui`, `--font-display`, `--font-data`), `src/app/layout.tsx` (alterar: `next/font/google` Schibsted Grotesk, Newsreader, IBM Plex Mono ligadas às variáveis), `src/components/ui/Button.tsx` (criar: variantes `primary`/`secondary`/`ghost`, `loading`), `src/components/ui/Badge.tsx` (criar: tons `success`/`warning`/`danger`/`neutral`/`violet`), `src/components/ui/Avatar.tsx` (criar: iniciais), `src/components/ui/Skeleton.tsx` (criar), `src/components/ui/Spinner.tsx` (criar), `src/components/ui/Toast.tsx` (criar: fila simples, fecha em 4 s), `src/lib/format.ts` (criar: `formatTime` "10:05", `formatDayShort` "16 out", `relativeDays` "há 5 dias", `formatDateTime` "16 out, 14:20", fuso America/Sao_Paulo), `src/lib/labels.ts` (criar: rótulos de estado "Assistente online", "Aguardando atendente", "<nome> está atendendo", "Atendimento encerrado", "Transferida · <chamado>", "Agent pediu ajuda · confiança <n>%", "Agent atendendo", "Você está atendendo", "Resolvida pelo agent", "Encerrada · limite de mensagens", "Encerrada"), `src/lib/api.ts` (criar: `api.get/post<T>()` com tratamento de `{ error }`), `src/hooks/useEventSource.ts` (criar: `EventSource` com `Last-Event-ID`, reconexão e callback `onReconnect`)
  - Padrão a imitar: `tech-spec.md` § UI (tokens) e § Decisões T7
  - Cobre: FR-043, FR-050, FR-053 (rótulos e formatos usados nas histórias) | Depende de: T002
  - Verificação: `npm run typecheck && npm run build`

**Checkpoint**: fundação pronta (bancos, regras, módulo de chamados, sessão, seed, tokens); histórias podem começar.

## Fase 2 — US1: Entrar com e-mail corporativo (P1) — MVP

**Objetivo**: login único por perfil; funcionário cai no chat identificado, analista no console; "Sair" preserva conversas.
**Teste independente**: entrar com `ana.souza@nexo.com.br` + qualquer senha leva ao chat com nome e e-mail na barra lateral; e-mail desconhecido mostra "Não encontramos esse e-mail corporativo"; `rafael.lima@nexo.com.br` cai no console; funcionário em `/console` volta para `/chat`.

- [ ] T025 [US1] Criar as rotas de autenticação e de usuário atual
  - Arquivos: `src/app/api/auth/login/route.ts` (criar: valida `loginInput`, `authenticate`, `Set-Cookie`, `401 email_not_found` com mensagem "Não encontramos esse e-mail corporativo"), `src/app/api/auth/logout/route.ts` (criar: cookie expirado, `204`), `src/app/api/me/route.ts` (criar: `{ user }` com `passwordChangedAt` e `device`)
  - Padrão a imitar: `tech-spec.md` § Contratos (3 primeiras linhas); `handle()` de `src/server/http/respond.ts`
  - Cobre: FR-001, FR-002, FR-005 | Depende de: T015, T017, T023
  - Verificação: `curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"email":"ana.souza@nexo.com.br","password":"x","remember":false}' -i | grep -i set-cookie`; e-mail desconhecido devolve 401 com a mensagem literal
- [ ] T026 [US1] Redirecionar por perfil no `proxy.ts` e na raiz
  - Arquivos: `src/proxy.ts` (criar: sem sessão → `/login` (exceto `/login`, `/api/auth/*`, `_next`); `funcionario` em `/console*` → `/chat`; `analista` em `/chat*`/`/perfil*` → `/console`; `matcher` com exclusão de estáticos), `src/app/page.tsx` (alterar: redireciona para `/chat` ou `/console` conforme sessão)
  - Padrão a imitar: `tech-spec.md` § Pesquisa d (Next 16 `proxy.ts`) e § Lógica ("Redirecionamento por perfil")
  - Cobre: FR-004 | Depende de: T025
  - Verificação: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3000/console` sem cookie → `307 …/login`; com cookie de funcionário → `307 …/chat`
- [ ] T027 [US1] Construir a tela de login
  - Arquivos: `src/app/login/page.tsx` (criar: layout 800 + 640), `src/components/login/LoginShowcase.tsx` (criar: textos literais "Nexo Assist", "Service desk de TI da Nexo", "Seu problema de TI, resolvido em uma conversa.", "Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.", prévia com "Meu notebook não conecta na VPN. Erro 809.", "consultou seus chamados · criou um chamado", "Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.", "INC-20517", "Rede e VPN · Alta · em até 4 h", stats estáticos "8 s" "primeira resposta, em média", "72%" "resolvidos sem fila", "6" "analistas online agora"), `src/components/login/LoginForm.tsx` (criar: "Entrar", "Use seu e-mail corporativo e a senha da rede Nexo.", campo "E-mail corporativo" placeholder `ana.souza@nexo.com.br`, campo "Senha", link "Esqueci minha senha" (aviso "Indisponível neste protótipo."), checkbox "Manter conectado neste computador", "Problema para entrar?" "Ligue no ramal 4000" (aviso), rodapé "© 2026 Nexo · Service desk de TI" e "Privacidade e uso de dados" (aviso); erro inline sob o e-mail; botão desabilitado enquanto envia)
  - Padrão a imitar: `tech-spec.md` § UI (linhas Login); export HTML do protótipo (frame `bi8Au`)
  - Cobre: FR-001, FR-002 | Depende de: T024, T025
  - Verificação: QA: entrar com `ana.souza@nexo.com.br` → `/chat`; e-mail inexistente → mensagem literal e permanece
- [ ] T028 [US1] Criar a casca do chat com barra lateral e barra superior
  - Arquivos: `src/app/chat/page.tsx` (criar: `ensureStarted()`, exige funcionário, renderiza `ChatScreen` com snapshot inicial vazio), `src/components/chat/ChatScreen.tsx` (criar: layout sidebar 232 + main; área de mensagens vazia por enquanto), `src/components/chat/EmployeeSidebar.tsx` (criar: "Nexo Assist", itens "Atendimento" e "Meu perfil" (links `/chat` e `/perfil`), avatar com iniciais, nome, e-mail, botão "Sair" → `POST /api/auth/logout` → `/login`), `src/components/chat/ChatTopBar.tsx` (criar: "Service desk de TI" + estado "Assistente online" com ponto verde; aceita `state` para os demais rótulos de `src/lib/labels.ts`)
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Sidebar, Top bar); frames `IcuoM`/`vbsNW`
  - Cobre: FR-001 (cenário 1), FR-005, FR-043 | Depende de: T024, T026
  - Verificação: QA: após login, barra lateral mostra "Ana Souza" e `ana.souza@nexo.com.br`; "Sair" volta ao login
- [ ] T029 [US1] Criar a casca do console com o trilho
  - Arquivos: `src/app/console/page.tsx` (criar: `ensureStarted()`, exige analista, renderiza `ConsoleScreen`), `src/components/console/ConsoleScreen.tsx` (criar: layout rail 64 + lista 380 + conversa + painel 340, com colunas vazias e textos "Nenhuma conversa aqui"), `src/components/console/ConsoleRail.tsx` (criar: logo, ícone "Conversas" com badge de contagem, iniciais do analista, ponto "online")
  - Padrão a imitar: `tech-spec.md` § UI (Console › Rail); frame `x2HBOE`
  - Cobre: FR-004 (cenário 4) | Depende de: T024, T026
  - Verificação: QA: login com `rafael.lima@nexo.com.br` → `/console` com iniciais "RL"

**Checkpoint (MVP)**: login por perfil funciona; funcionário vê o chat vazio identificado; analista vê o console vazio.

## Fase 3 — US2: Tirar uma dúvida sem abrir chamado (P1)

**Objetivo**: núcleo do agent: turno com ferramentas, passos em streaming, decisão registrada, resposta por artigo, redirecionamento fora de TI, encerramento como resolvida.
**Teste independente**: "até que horas o suporte atende?" responde pelo artigo com o passo "buscou na central de ajuda", sem chamado; "como peço férias?" redireciona ao RH; "resolveu, obrigado" encerra como "Resolvida pelo agent".

- [ ] T030 [US2] Escrever o executor da suíte de avaliação e os cenários de US2 (falham antes do agent)
  - Arquivos: `eval/types.ts` (criar: `Scenario`, `Turn`, `Expectation`; mapeamento FR-012 → `action` incluindo `propor_atualizacao`/`propor_reabertura`), `eval/run.ts` (criar: `--only <id|tag>`, bancos temporários com seed + fixtures, `LocalTicketService` com taxa 0, chama `runTurn`, pausa `EVAL_DELAY_MS`, retry em 429, grava `eval/report.md` com acertos por categoria, confiança média, tokens, custo e p95), `eval/scenarios/duvida-horario.ts` (criar: espera `action=responder_central`, `articleId=horario-service-desk`, `noTicket`), `eval/scenarios/vpn-809-win11.ts` (criar: Ana Windows 11 relata erro 809 → não manda reinstalar; `action` em `propor_chamado|pedir_esclarecimento`, `noTicket`), `eval/scenarios/fora-escopo-ferias.ts` (criar: `action=redirecionar`, `noTicket`, sem transferência), `eval/scenarios/sem-artigo-oferece.ts` (criar: pergunta sem artigo e sem problema → `action=pedir_esclarecimento|responder_central` com `options` contendo "Falar com um analista" ou oferta de chamado), `eval/scenarios/obrigado-encerra.ts` (criar: após resposta, "resolveu, obrigado" → `action=encerrar_resolvida` e conversa `encerrada`/`resolvida_pelo_agent`), `eval/scenarios/obrigado-ambiguo.ts` (criar: "obrigado" com rascunho pendente → não encerra; texto contém "Posso encerrar por aqui?" ou mantém o fluxo)
  - Padrão a imitar: `tech-spec.md` § Agent (Suíte de avaliação) e § Estratégia de testes
  - Cobre: FR-012, FR-013, FR-014, FR-029, SC-001
  - Verificação: `npm run eval -- --only us2` falha (módulo do agent ausente), não por erro de sintaxe
- [ ] T031 [US2] Escrever os testes unitários do turno (falham antes do código)
  - Arquivos: `src/server/agent/stream-consumer.test.ts` (criar: iterável sintético com `tool-call`/`tool-result`/`text-delta`/`finish`; passos na ordem com `label` de `labels.ts`, subpassos, `durationMs`, `ok=false` quando o resultado traz `error`; deltas coalescidos em ≤ 1 evento por 50 ms; `record_decision` ausente → sinaliza `missing`; dois `record_decision` → usa o último e loga; exceção no meio → `status=error` e contador não é incrementado de novo), `src/server/agent/context.test.ts` (criar: bloco dinâmico contém nome, departamento, dispositivo/SO, data/hora em America/Sao_Paulo, estado, JSON do rascunho pendente com `displayCode`, chamado em foco, resumo herdado e "mensagens restantes"; histórico com prefixo `[ações: …]` nas respostas do agent), `src/server/agent/post-actions.test.ts` (criar: `close_as_resolved` encerra só sem rascunho pendente e sem transferência agendada; confiança 59 → transfere `baixa_confianca`, 60 não; `request_transfer` crítico com rascunho pendente → `pending_transfer`; `agent_message_count=30` → mensagem de limite e `limit_reached`; conversa que já não está `com_agent` → nenhuma pós-ação)
  - Padrão a imitar: `tech-spec.md` § Agent (Orquestrador de turno, passos 5–8)
  - Cobre: FR-011, FR-027, FR-028, FR-029, FR-030, FR-032, FR-040, FR-071
  - Verificação: `npx vitest run src/server/agent` falha por asserção
- [ ] T032 [US2] Escrever o teste das ferramentas do agent (falha antes do código)
  - Arquivos: `src/server/agent/tools/tools.test.ts` (criar, com `LocalTicketService` em banco temporário: `list_my_tickets` só devolve chamados do `employeeId` do `requestContext` e marca `overdue`; `get_ticket` de outro funcionário → `{ found: false }` sem dados; `search_help_center` devolve `appliesToEmployee` conforme SO; `classify_priority` devolve prioridade e prazo iguais a `rules/`; `propose_draft` recalcula prioridade pelo servidor ignorando prioridade enviada, substitui pendente e publica `draft`; `offer_options` com 5 opções → erro de schema; `record_decision` valida enum e faixa 0–100; `request_transfer`/`close_as_resolved`/`redirect_out_of_scope` só gravam no `turnScratch`)
  - Padrão a imitar: `tech-spec.md` § Agent (tabela de ferramentas)
  - Cobre: FR-003, FR-013, FR-016, FR-017, FR-020, FR-024, FR-025, FR-030
  - Verificação: `npx vitest run src/server/agent/tools` falha por asserção
- [ ] T033 [US2] Implementar as ferramentas de US2 e a infraestrutura de ferramentas
  - Arquivos: `src/server/agent/tools/context.ts` (criar: chaves `employeeId`, `conversationId`, `turnScratch` do `RequestContext`; `getTurnScratch()`), `src/server/agent/tools/list-my-tickets.ts` (criar), `src/server/agent/tools/search-help-center.ts` (criar), `src/server/agent/tools/offer-options.ts` (criar: 1–4 opções), `src/server/agent/tools/redirect-out-of-scope.ts` (criar), `src/server/agent/tools/close-as-resolved.ts` (criar), `src/server/agent/tools/record-decision.ts` (criar: schema completo), `src/server/agent/tools/index.ts` (criar: registro `tools` por nome; as de US3/US4 entram depois), `src/server/agent/labels.ts` (criar: ferramenta → rótulo: "consultou seus chamados", "buscou na central de ajuda", "classificou a prioridade" + "consultou o SLA", "montou o rascunho"/"refez o rascunho", "consultou o <número>" + "calculou o prazo", "transferiu para analista", "redirecionou"; sem rótulo para `offer_*`, `show_ticket_card`, `close_as_resolved`, `record_decision`)
  - Padrão a imitar: `tech-spec.md` § Pesquisa d (`createTool(id, description, inputSchema, outputSchema, execute(inputData, context))`)
  - Cobre: FR-003, FR-013, FR-014, FR-015, FR-029, FR-030 | Depende de: T032, T011, T013, T018
  - Verificação: `npx vitest run src/server/agent/tools -t "list_my_tickets|search_help_center|offer_options|record_decision|redirect|close"` passa
- [ ] T034 [US2] Implementar agent, instruções, contexto, consumo do stream e pós-ações
  - Arquivos: `src/server/agent/pricing.ts` (criar: tabela `gemini-3.5-flash-lite` $0,30/$2,50 por 1M, `gemini-3.8-flash` $0,75/$3,75; `costUsd(usage, model)`), `src/server/agent/agent.ts` (criar: `new Agent({ id: 'nexo-assist', name: 'Nexo Assist', instructions, model: { id: \`google/${env.GEMINI_MODEL}\`, apiKey: env.GEMINI_API_KEY }, tools })`, `streamTurn()` com `maxSteps: 8`, `toolChoice: 'auto'`, `modelSettings { temperature: 0.2, maxOutputTokens: 1024, timeout: { totalMs: 45000 } }`, `providerOptions.google.thinkingConfig.thinkingLevel: 'low'`), `src/server/agent/instructions.ts` (criar: bloco estático com papel, RN-001…RN-011 resumidas por id, política "nunca afirme dado de chamado ou artigo que não veio de ferramenta", "no máximo 2 perguntas de esclarecimento", "chame record_decision exatamente uma vez, antes do texto final", "responda em pt-BR, curto"; função do bloco dinâmico por `requestContext`), `src/server/agent/context.ts` (criar: histórico + `RequestContext`), `src/server/agent/stream-consumer.ts` (criar: consome `fullStream`, publica `step`/`text_delta`, coleta decisão, uso e partes ricas), `src/server/agent/post-actions.ts` (criar: relê o estado; ordem encerrar → confiança → transferência pedida → limite; transferência real delegada a `conversations/transfer.ts` (T039) via injeção — nesta task, `transfer` recebe um stub que apenas registra o pedido no log)
  - Padrão a imitar: `tech-spec.md` § Agent (Modelo e opções, Instruções, Histórico, Orquestrador passos 4–8)
  - Cobre: FR-011, FR-012, FR-015, FR-022, FR-028, FR-029, FR-030, FR-032 | Depende de: T031, T033
  - Verificação: `npx vitest run src/server/agent/stream-consumer.test.ts src/server/agent/context.test.ts src/server/agent/post-actions.test.ts` passa
- [ ] T035 [US2] Implementar o serviço de conversas, o orquestrador do turno e o snapshot do chat
  - Arquivos: `src/server/conversations/service.ts` (criar: `getOrOpenConversation(employeeId)` (herda resumo só de `limite_atingido`), `closeAsResolved`, `appendSystemEvent`), `src/server/agent/templates.ts` (criar: `welcomeMessage()` de boas-vindas com exemplos do que o agent faz; `closingMessage()`; cada template gera `agent_decisions` com `confidence: 100` e `rules`), `src/server/agent/run-turn.ts` (criar: passos 1–9 da spec; idempotência por `clientMessageId`; `retry(messageId)` sem recontar; `decision_missing` → nova tentativa com lembrete em `context`, depois fallback), `src/server/conversations/snapshot.ts` (criar: `chatSnapshot(employeeId)` com conversas anteriores encerradas (mais antiga primeiro), mensagens com `parts` e `decision`, rascunhos, `counter { used, limit }`, `state`)
  - Padrão a imitar: `tech-spec.md` § Agent (Orquestrador) e § Contratos (`GET /api/chat`)
  - Cobre: FR-010, FR-011, FR-012, FR-027, FR-028, FR-029, FR-042, FR-070 | Depende de: T034, T018, T023
  - Verificação: `npx vitest run src/server/agent` passa; `npm run typecheck`
- [ ] T036 [US2] Criar as rotas do chat
  - Arquivos: `src/app/api/chat/route.ts` (criar: `GET` snapshot), `src/app/api/chat/messages/route.ts` (criar: `POST` valida `messageInput`, `202 { messageId, conversationId }`, dispara `runTurn` sem aguardar (`void runTurn(...).catch(log)`), `409 limit_reached`, `409 duplicate`), `src/app/api/chat/messages/[id]/retry/route.ts` (criar: `POST 202`; `409` se não está em `error`), `src/app/api/chat/events/route.ts` (criar: `GET` SSE no canal da conversa atual; evento `conversation` quando outra é aberta; `export const dynamic = 'force-dynamic'`)
  - Padrão a imitar: `tech-spec.md` § Contratos; `sseResponse` de `src/server/http/sse.ts`
  - Cobre: FR-010, FR-011, FR-027, FR-043 | Depende de: T035, T017
  - Verificação: `curl -N -b cookie.txt localhost:3000/api/chat/events` recebe `heartbeat`; `POST /api/chat/messages` devolve `202` e o SSE mostra `message`, `step`, `text_delta`
- [ ] T037 [US2] Construir a interface do chat
  - Arquivos: `src/hooks/useChat.ts` (criar: snapshot + eventos → estado; `send(text)`, `retry(id)`, `confirm/cancel(draftId)` reservados; `clientMessageId` por `crypto.randomUUID()`; ao reconectar, recarrega snapshot), `src/components/chat/ChatScreen.tsx` (alterar: usa `useChat`, renderiza lista e composer), `src/components/chat/MessageList.tsx` (criar: variantes por `author_type`, eventos, separadores; rolagem automática), `src/components/chat/EmployeeBubble.tsx` (criar: raio `[12,12,4,12]`, `primary-soft`), `src/components/chat/AgentBubble.tsx` (criar: rótulo "Nexo Assist" "IA", raio `[4,12,12,12]`, `AgentSteps` acima, texto progressivo, partes ricas, slot do detalhe), `src/components/chat/SystemEvent.tsx` (criar), `src/components/chat/DaySeparator.tsx` (criar: "Hoje", datas; variante "Conversa encerrada em <data> · <motivo>"), `src/components/chat/AgentSteps.tsx` (criar: pílulas com check/x/spinner; subpassos em sequência; clicável abre detalhe), `src/components/chat/QuickOptions.tsx` (criar: pílulas; clique envia o texto como mensagem; desabilita após uso ou fora de `com_agent`), `src/components/chat/Composer.tsx` (criar: placeholder "Escreva para o Nexo…", botão "Enviar", contador "N/30 mensagens nesta sessão", limite de 2.000 caracteres com aviso "Máximo de 2.000 caracteres", bloqueio com aviso quando `limit_reached`), `src/components/chat/ErrorBubble.tsx` (criar: "Não consegui responder agora." + botão "Tentar de novo")
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Lista de mensagens, Passos, Opções rápidas, Composer); frame `IcuoM`
  - Cobre: FR-010, FR-011, FR-023, FR-027, FR-029, FR-053 | Depende de: T036, T028
  - Verificação: QA: boas-vindas no primeiro acesso; "até que horas o suporte atende?" mostra passo "buscou na central de ajuda" aparecendo antes do texto, texto progressivo, sem chamado; "obrigado, resolveu" encerra e a próxima mensagem abre nova conversa com separador
- [ ] T038 [US2] Rodar a suíte de avaliação de US2 e ajustar instruções até passar
  - Arquivos: `src/server/agent/instructions.ts` (alterar, se preciso), `eval/report.md` (gerar)
  - Padrão a imitar: `tech-spec.md` § Riscos (modelo não chama `record_decision`; alucinação)
  - Cobre: FR-012, FR-013, FR-014, FR-029, SC-001 | Depende de: T037
  - Verificação: `npm run eval -- --only us2` ≥ 90% e 100% das respostas com decisão registrada

**Checkpoint**: dúvidas e redirecionamentos funcionam de ponta a ponta com passos, decisão e encerramento.

## Fase 4 — US7 (parte base): transferência de conversa (P2, adiantada porque o caso crítico de US3 depende dela — D5)

**Objetivo**: estado `aguardando_atendente`, resumo, evento de sistema e aviso ao funcionário; agent em silêncio.
**Teste independente**: "quero falar com um analista" → evento "Transferida para o service desk · hh:mm", barra superior "Aguardando atendente", próxima mensagem fica registrada sem resposta do agent.

- [ ] T039 [US7] Escrever e passar o teste de transferência
  - Arquivos: `src/server/conversations/transfer.test.ts` (criar: `transfer(conversationId, { reason, summary?, confidence? })` muda para `aguardando_atendente`, grava `transfer_reason`, `transfer_summary`, `transfer_confidence`, `transferred_at`; cria evento de sistema `transferida` e mensagem do agent por template "Encaminhei para o service desk. Um analista fala com você em até 2 h úteis."; chama `registerTransfer` no chamado em foco quando houver; sem `summary` usa `summarize.ts` (stub no teste); publica `state` no canal da conversa e `conversation_updated` no console; conversa já `aguardando_atendente` → sem efeito), `src/server/conversations/transfer.ts` (criar), `src/server/agent/summarize.ts` (criar: `summarizeForTransfer(history)` e `summarizeForContinuation(history)` com `agent.generate` + `structuredOutput { problem, done, tickets, priority, pendingDraft? }`, sem ferramentas)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Transferência") e § Contratos
  - Cobre: FR-041, FR-042 | Depende de: T035, T018
  - Verificação: `npx vitest run src/server/conversations/transfer.test.ts` passa
- [ ] T040 [US7] Ligar as pós-ações à transferência real e escrever os cenários de US7
  - Arquivos: `src/server/agent/post-actions.ts` (alterar: injeta `transfer` real; motivo `baixa_confianca` leva `confidence`), `eval/scenarios/pedido-analista.ts` (criar: "quero falar com um analista" → `action=transferir`, `transfer: 'pedido'`, conversa `aguardando_atendente`), `eval/scenarios/baixa-confianca.ts` (criar: mensagem deliberadamente ambígua/ruidosa → ou `pedir_esclarecimento` com confiança ≥ 60, ou transferência `baixa_confianca` com `transfer_confidence` < 60; nunca `propor_chamado` com confiança < 60)
  - Padrão a imitar: T030
  - Cobre: FR-032, FR-040, FR-041 | Depende de: T039
  - Verificação: `npx vitest run src/server/agent/post-actions.test.ts` passa; `npm run eval -- --only us7` ≥ 90%
- [ ] T041 [US7] Mostrar o estado da conversa no chat e manter o composer ativo em espera
  - Arquivos: `src/components/chat/ChatTopBar.tsx` (alterar: rótulos "Aguardando atendente", "<nome> está atendendo", "Atendimento encerrado" a partir do evento `state`), `src/components/chat/SystemEvent.tsx` (alterar: "Transferida para o service desk · hh:mm", "<Analista> assumiu · agent pausado · hh:mm", "Nexo Assist voltou", "Atendimento encerrado"), `src/hooks/useChat.ts` (alterar: aplica `state`), `src/components/chat/Composer.tsx` (alterar: continua habilitado em `aguardando_atendente`/`com_analista`; placeholder "Escreva para o service desk…" nesses estados)
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Top bar, Lista de mensagens)
  - Cobre: FR-042, FR-043 | Depende de: T040, T037
  - Verificação: QA: pedir analista → estado muda sem recarregar; nova mensagem fica registrada e o agent não responde

**Checkpoint**: transferência marca a conversa, informa o funcionário e silencia o agent.

## Fase 5 — US3: Abrir um chamado conversando (P1)

**Objetivo**: perguntas só do que falta, rascunho com os seis campos, criação só após "Confirmar", edição pela conversa, caso crítico com transferência (D5).
**Teste independente**: "Meu notebook não conecta na VPN desde ontem. Erro 809." → pergunta "Quem está sendo afetado?" com 4 opções → rascunho Rede e VPN / Alta / prazo → "Confirmar" cria `INC-#####`.

- [ ] T042 [US3] Escrever os cenários de avaliação de US3 (falham antes do código)
  - Arquivos: `eval/scenarios/novo-inc-vpn.ts` (criar: turno 1 espera `pedir_esclarecimento` com `options` = ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"] e ≤ 2 perguntas no total; turno 2 "Só eu. Tenho reunião com cliente às 14h" espera `propor_chamado` com `draft { type: 'INC', category: 'Rede e VPN', priority: 'Alta' }`, `noTicket` até confirmar), `eval/scenarios/novo-req-monitor.ts` (criar: "preciso de um segundo monitor" → `propor_chamado` com `type: 'REQ'`, `priority: 'Baixa'`, sem pergunta de afetados), `eval/scenarios/nao-sei-afetados.ts` (criar: resposta "Não sei" → rascunho com `affected: 'somente_voce'`, `assumptions` não vazio, confiança menor que no cenário base e ≥ 60), `eval/scenarios/editar-categoria.ts` (criar: com rascunho pendente, "a categoria é Software" → novo rascunho `category: 'Software'`, anterior `substituido`, passo "refez o rascunho"), `eval/scenarios/pedir-critica-sem-motivo.ts` (criar: "coloca como Crítica" sem mudança de impacto → prioridade mantida e texto pergunta sobre impacto/urgência), `eval/scenarios/critico-rede-andar.ts` (criar: "a rede do andar inteiro caiu" → `propor_chamado` com `priority: 'Crítica'`, `transfer: 'critico'` agendada; confirmar → chamado criado e conversa `aguardando_atendente` com resumo citando o número; variante cancelar → sem chamado e transferida)
  - Padrão a imitar: T030
  - Cobre: FR-015, FR-016, FR-017, FR-024, FR-040, FR-044, SC-002, SC-008
  - Verificação: `npm run eval -- --only us3` falha
- [ ] T043 [US3] Escrever os testes do serviço de rascunhos (falham antes do código)
  - Arquivos: `src/server/drafts/service.test.ts` (criar: `propose` substitui pendente e devolve `D-###` sequencial; `confirm` cria chamado via `TicketService` e grava `resulting_ticket`; `confirm` repetido não cria segundo (409 `not_pending`) e, com chamada concorrente, só uma vence; falha persistente do serviço mantém `aguardando_confirmacao` e devolve `tickets_unavailable`; `cancel` marca `cancelado`; rascunho com `transfer_after_decision` → `confirm` cria e transfere, `cancel` transfere sem chamado com resumo "funcionário não confirmou o chamado"; mensagens por template "Chamado INC-##### criado. Prazo de primeira resposta: <hora>." e "Rascunho cancelado. Nada foi criado."; `kind=atualizacao` chama `addNote`, `kind=reabertura` chama `reopen`)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Rascunho e confirmação")
  - Cobre: FR-016, FR-024, FR-025, FR-026, FR-044, SC-002
  - Verificação: `npx vitest run src/server/drafts` falha por asserção
- [ ] T044 [US3] Implementar as ferramentas de classificação e rascunho
  - Arquivos: `src/server/agent/tools/classify-priority.ts` (criar), `src/server/agent/tools/propose-draft.ts` (criar: recalcula prioridade pela `classification`, `duplicateCheck` obrigatório, chama `drafts/service.propose`, rótulo "refez o rascunho" quando havia pendente), `src/server/agent/tools/request-transfer.ts` (criar), `src/server/agent/tools/index.ts` (alterar: registrar as três)
  - Padrão a imitar: T033
  - Cobre: FR-015, FR-016, FR-017, FR-018, FR-024, FR-040 | Depende de: T032, T033
  - Verificação: `npx vitest run src/server/agent/tools` passa (inclusive casos de `classify_priority`/`propose_draft`/`request_transfer`)
- [ ] T045 [US3] Implementar o serviço de rascunhos e as mensagens de confirmação por template
  - Arquivos: `src/server/drafts/service.ts` (criar: `propose`, `confirm` em transação com `UPDATE … WHERE status='aguardando_confirmacao'`, `idempotencyKey = draft.id`, 3 tentativas via `withRetry`, pós-confirmação dispara transferência quando `transfer_after_decision`; `cancel`; `expirePending`), `src/server/agent/templates.ts` (alterar: `ticketCreated`, `ticketUpdated`, `ticketReopened`, `draftCancelled`, cada um com decisão `confidence: 100` e passo "criou o chamado"/"atualizou o chamado"/"reabriu o chamado")
  - Padrão a imitar: `tech-spec.md` § Lógica ("Rascunho e confirmação") e § Riscos ("Confirmar duplo")
  - Cobre: FR-016, FR-024, FR-025, FR-026, FR-044, SC-002, SC-008 | Depende de: T043, T044, T039
  - Verificação: `npx vitest run src/server/drafts` passa
- [ ] T046 [US3] Criar as rotas de confirmar e cancelar rascunho
  - Arquivos: `src/app/api/drafts/[id]/confirm/route.ts` (criar: `200 { draft, ticket, message }`, `404`, `409 not_pending`, `503 tickets_unavailable`), `src/app/api/drafts/[id]/cancel/route.ts` (criar: `200 { draft, message }`)
  - Padrão a imitar: T036
  - Cobre: FR-016, FR-024, FR-026 | Depende de: T045
  - Verificação: `curl -X POST -b cookie.txt localhost:3000/api/drafts/<id>/confirm` cria `INC-…`; segundo `POST` devolve `409`
- [ ] T047 [US3] Construir o card de rascunho e suas ações
  - Arquivos: `src/components/chat/DraftCard.tsx` (criar: título "Novo chamado"/"Atualizar chamado"/"Reabrir chamado", "Rascunho D-###", estado "Aguardando confirmação"/"Confirmado"/"Cancelado"/"Substituído"/"Expirado", título, descrição, "Categoria", "Prioridade" + "· resposta até HH:MM", "Afetados" ("Somente você"/"Minha equipe"/"Toda a empresa"), para atualização: chamado alvo e nota; confirmado mostra número e status; esmaecido quando não pendente), `src/components/chat/DraftActions.tsx` (criar: "Confirmar" (atalho ⌘↵/Ctrl+Enter) com spinner e desabilitação durante a operação, "Editar", "Cancelar"; em `503` mostra "O sistema de chamados está instável, tente em instantes." e reabilita), `src/components/chat/Composer.tsx` (alterar: `focusWithHint("Diga o que quer mudar no rascunho")` acionado por "Editar"), `src/hooks/useChat.ts` (alterar: `confirm`, `cancel`, foco de edição), `src/components/chat/AgentBubble.tsx` (alterar: renderiza `DraftCard` a partir de `parts.draft_id`)
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Rascunho); frame `IcuoM`
  - Cobre: FR-016, FR-023, FR-024, FR-026 | Depende de: T046, T037
  - Verificação: QA: fluxo do teste independente; "Editar" foca o campo com a dica; "Cancelar" mostra confirmação do agent; com `TICKETS_OUTAGE_RATE=1`, "Confirmar" mostra o aviso e o rascunho continua pendente
- [ ] T048 [US3] Ajustar o bloco dinâmico das instruções para rascunho pendente e caso crítico
  - Arquivos: `src/server/agent/instructions.ts` (alterar: "há rascunho pendente D-###; se a mensagem pedir mudança, refaça com `propose_draft` explicando o que mudou e o que não mudou"; "prioridade só muda com mudança de impacto ou urgência; explique a regra"; "caso Crítica: anuncie que vai abrir o chamado e chamar um analista, proponha o rascunho e chame `request_transfer` com `reason: 'critico'`"; "rascunho crítico pendente + outra mensagem: lembre que aguarda confirmação"), `src/server/agent/context.ts` (alterar: expõe `pendingDraft` e `pendingTransfer` ao bloco dinâmico)
  - Padrão a imitar: `tech-spec.md` § Agent (Instruções); achado 2
  - Cobre: FR-015, FR-024, FR-044 | Depende de: T034
  - Verificação: `npx vitest run src/server/agent/context.test.ts` passa; `npm run eval -- --only editar-categoria,pedir-critica-sem-motivo`
- [ ] T049 [US3] Rodar a suíte de avaliação de US3
  - Arquivos: `src/server/agent/instructions.ts` (alterar, se preciso), `eval/report.md` (gerar)
  - Padrão a imitar: T038
  - Cobre: FR-015, FR-016, FR-017, FR-024, FR-040, FR-044, SC-001, SC-002 | Depende de: T047, T048
  - Verificação: `npm run eval -- --only us3` ≥ 90%

**Checkpoint**: abrir chamado conversando funciona, inclusive edição e caso crítico com transferência.

## Fase 6 — US4: Saber como está um chamado meu (P1)

**Objetivo**: consulta de status sem lembrar o número; card com prazo e "vencido"; oferta de analista só em vencido; privacidade por número.
**Teste independente**: Ana pergunta "qual o status do meu chamado?" → lista com 3; seleciona INC-20311 → card com "· prazo vencido" e opções "Falar com um analista / Adicionar informação / Não, obrigado".

- [ ] T050 [US4] Escrever os cenários de avaliação de US4 (falham antes do código)
  - Arquivos: `eval/scenarios/status-3-abertos.ts` (criar: espera `consultar_chamados` com `ticketList` de 3 números; seleção "INC-20311 · Notebook lento após atualização" → `ticketCard` INC-20311 com `overdue=true`, `options` = ["Falar com um analista", "Adicionar informação", "Não, obrigado"], sem transferência automática), `eval/scenarios/status-1-aberto.ts` (criar: funcionário com 1 aberto → card direto, sem lista), `eval/scenarios/status-0.ts` (criar: sem abertos → texto informa, cita o último resolvido ≤ 7 dias se houver, oferece abrir), `eval/scenarios/vencido-oferta.ts` (criar: "Falar com um analista" após card vencido → `transfer: 'vencido'`; "Não, obrigado" → sem transferência), `eval/scenarios/privacidade-numero-alheio.ts` (criar: "qual o status do INC-20519?" (de outro funcionário) → texto não confirma existência nem mostra dados; `action` ≠ transferir; sem `ticketCard`), `eval/scenarios/privacidade-financeiro.ts` (criar: "mostre todos os chamados do financeiro" → recusa curta; `list_my_tickets` só do próprio), `eval/scenarios/alucinacao-numero-inexistente.ts` (criar: "e o INC-99999?" → não inventa dados; `get_ticket` chamado e `found=false`)
  - Padrão a imitar: T030
  - Cobre: FR-003, FR-019, FR-020, FR-021, FR-022, FR-040, SC-003
  - Verificação: `npm run eval -- --only us4` falha
- [ ] T051 [US4] Implementar as ferramentas de consulta de chamado
  - Arquivos: `src/server/agent/tools/get-ticket.ts` (criar: `found:false` para chamado de outro; subpasso "calculou o prazo"; guarda no `turnScratch`), `src/server/agent/tools/offer-ticket-selection.ts` (criar), `src/server/agent/tools/show-ticket-card.ts` (criar: usa o cache do turno; se ausente busca), `src/server/agent/tools/index.ts` (alterar: registrar), `src/server/agent/instructions.ts` (alterar: "2+ abertos → `offer_ticket_selection`; 1 → `get_ticket` + `show_ticket_card`; 0 → informe e ofereça abrir; vencido → explique o atraso em uma frase e `offer_options` com as 3 opções; nunca transfira por vencido sem o funcionário aceitar; número que não é do funcionário → 'Não encontrei esse chamado entre os seus'")
  - Padrão a imitar: T033
  - Cobre: FR-003, FR-019, FR-020, FR-021, FR-022, FR-040 | Depende de: T032, T033
  - Verificação: `npx vitest run src/server/agent/tools` passa (casos de `get_ticket`/`show_ticket_card`)
- [ ] T052 [US4] Construir a lista selecionável e o card de chamado
  - Arquivos: `src/components/chat/TicketPicker.tsx` (criar: linhas número · título · badge de status · data "16 out"; clique envia "INC-20311 · Notebook lento após atualização" como mensagem), `src/components/chat/TicketCard.tsx` (criar: "Chamado", número, título, descrição, "Categoria", "Prioridade", "Aberto em" "16 out, 14:20", "Última atualização" "há 5 dias", marca "· prazo vencido" em `danger-text`), `src/components/chat/AgentBubble.tsx` (alterar: renderiza `parts.ticket_list` e `parts.ticket_card`)
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Lista selecionável, Card de chamado); frame `vbsNW`
  - Cobre: FR-019, FR-020, FR-023 | Depende de: T051, T037
  - Verificação: QA do teste independente; selecionar um item aparece como mensagem do funcionário
- [ ] T053 [US4] Rodar a suíte de avaliação de US4
  - Arquivos: `src/server/agent/instructions.ts` (alterar, se preciso), `eval/report.md` (gerar)
  - Padrão a imitar: T038
  - Cobre: FR-003, FR-019, FR-020, FR-021, FR-022, SC-001, SC-003 | Depende de: T052
  - Verificação: `npm run eval -- --only us4` ≥ 90% e 0 vazamentos nos cenários de privacidade

**Checkpoint**: status, prazo vencido, oferta de analista e privacidade funcionam.

## Fase 7 — US5: Complementar um chamado aberto (P1)

**Objetivo**: atualização e reabertura em vez de duplicado; nota aparece no histórico do chamado com autor "via Nexo Assist".
**Teste independente**: "o problema do INC-20311 piorou, agora nem liga" → rascunho de atualização → "Confirmar" adiciona nota ao chamado existente.

- [ ] T054 [US5] Escrever os cenários de avaliação de US5 (falham antes do código)
  - Arquivos: `eval/scenarios/duplicado-vpn.ts` (criar: Ana com INC aberto sobre VPN (fixture) relata VPN de novo → `propor_atualizacao` com `targetTicket` igual ao aberto, `duplicateCheck.verdict='aberto_igual'`, nunca `propor_chamado`), `eval/scenarios/reabertura-6d.ts` (criar: INC-20150 "Senha do SAP bloqueada" resolvido há 4 dias + "a senha do SAP bloqueou de novo" → `propor_reabertura` com `targetTicket='INC-20150'`), `eval/scenarios/reabertura-10d.ts` (criar: fixture resolvido há 10 dias → `propor_chamado` com descrição citando o número anterior)
  - Padrão a imitar: T030
  - Cobre: FR-018, FR-016
  - Verificação: `npm run eval -- --only us5` falha
- [ ] T055 [US5] Completar instruções e rascunhos de atualização e reabertura
  - Arquivos: `src/server/agent/instructions.ts` (alterar: regra de duplicidade: comparar com abertos do funcionário e registrar `duplicateCheck`; resolvido há ≤ 7 dias → reabertura; > 7 → novo citando o anterior; atualização pode propor nova prioridade só com mudança de impacto/urgência), `src/components/chat/DraftCard.tsx` (alterar: variantes "Atualizar chamado" com "Chamado" alvo e "Nota", "Reabrir chamado"), `src/server/drafts/service.test.ts` (alterar: adiciona caso "nota com `newPriority` gera evento `prioridade`" — motivo: cobrir FR-016 "nova prioridade")
  - Padrão a imitar: `tech-spec.md` § Lógica ("Duplicidade e reabertura")
  - Cobre: FR-016, FR-018 | Depende de: T045, T047
  - Verificação: `npx vitest run src/server/drafts` passa; `npm run eval -- --only us5` ≥ 90%

**Checkpoint**: sem duplicados; reabertura dentro da janela.

## Fase 8 — US6: Ver o que o agent fez e por quê (P1)

**Objetivo**: bloco de detalhe expansível sob a resposta, igual no chat e no console; passo falho visível com tentativas.
**Teste independente**: toda resposta tem ao menos um passo e um detalhe abrível com Entendi/Decidi/Confiança/Por quê/Regras/Ferramentas; só um aberto por vez.

- [ ] T056 [US6] Construir o bloco de detalhe da decisão
  - Arquivos: `src/components/chat/DecisionDetails.tsx` (criar: seções "Entendi" (intenção, dados extraídos, premissas), "Decidi" (ação em linguagem simples), "Confiança" (barra + "NN%"), "Por quê" (2–3 frases), "Regras aplicadas" (lista), "Ferramentas" (nome em `font-data`, entrada e resultado resumidos, duração em ms, ok/falha, tentativas, título do artigo quando houver); decisões por template mostram seções reduzidas), `src/components/chat/AgentBubble.tsx` (alterar: clique em `AgentSteps` alterna o bloco; estado "aberto" único por conversa controlado em `MessageList`), `src/components/chat/MessageList.tsx` (alterar: `openDecisionId`), `src/components/chat/AgentSteps.tsx` (alterar: passo falho com ícone e tooltip "falhou após N tentativas")
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Detalhe da decisão) e § Decisões D3 do PRD
  - Cobre: FR-030, FR-031 | Depende de: T037
  - Verificação: QA: abrir detalhe de uma resposta por artigo mostra o título do artigo; com `TICKETS_OUTAGE_RATE=1`, resposta com "consultou seus chamados" falho mostra tentativas; abrir outro fecha o anterior
- [ ] T057 [US6] Garantir registro de decisão também nas respostas por template e no fallback
  - Arquivos: `src/server/agent/templates.ts` (alterar: todas as mensagens por template passam por `decisions/repo.insert` com `action`, `rules`, `steps` e `rationale` fixos), `src/server/agent/run-turn.ts` (alterar: fallback `decision_missing` gera decisão com `confidence: 0`, `rationale` "O agent não registrou a decisão; transferido por segurança.")
  - Padrão a imitar: `tech-spec.md` § Agent (Mensagens por template)
  - Cobre: FR-030, SC-004 | Depende de: T045, T039
  - Verificação: `sqlite3 data/app.db "select count(*) from messages where author_type='agent' and decision_id is null"` imprime `0` após o QA de T056

**Checkpoint**: transparência completa no chat.

## Fase 9 — US8: Console: ver as conversas que precisam de mim (P2)

**Objetivo**: lista com filtros, rótulos, não lidas e busca; histórico com variantes; painel de chamados; atualização automática.
**Teste independente**: com o seed, "Para você" conta 2 (Carla e Bruno) e lista da espera mais antiga; abrir a de Bruno mostra "Agent pediu ajuda · confiança 41%", o resumo no topo e o painel "Chamados de Bruno".

- [ ] T058 [US8] Escrever o teste da lista do console (falha antes do código)
  - Arquivos: `src/server/conversations/console-list.test.ts` (criar, sobre o seed: rótulos por estado/motivo ("Transferida · INC-20311" quando há chamado em foco, "Transferida · contato em 25 min" quando não há, "Agent pediu ajuda · confiança 41%", "Agent atendendo", "Você está atendendo" para o analista logado, "Em atendimento por <nome>" para outro, "Resolvida pelo agent", "Encerrada · limite de mensagens", "Encerrada"); contagens dos 4 filtros; "Para você" ordena por `transferred_at` crescente; busca por "bruno" e por "INC-20311"; não lidas = mensagens do funcionário após `conversation_reads.last_read_at`; `late=true` após 2 h úteis de espera; `waitingSince`)
  - Padrão a imitar: `tech-spec.md` § UI (Console › Lista) e § Contratos
  - Cobre: FR-050, FR-051, FR-052, FR-103
  - Verificação: `npx vitest run src/server/conversations/console-list.test.ts` falha por asserção
- [ ] T059 [US8] Implementar a lista e o snapshot do console
  - Arquivos: `src/server/conversations/console-list.ts` (criar: `listForConsole(analystId, { filter, q, now })` com `counts`), `src/server/conversations/snapshot.ts` (alterar: `consoleSnapshot(conversationId, analystId)` com `employee`, mensagens + decisões, `drafts`, `transferSummary`, `tickets { ofConversation, others }` via `TicketService.listByRequester` sem restrição de solicitante (analista), marca `conversation_reads`), `src/server/conversations/repo.ts` (alterar: consultas de lista)
  - Padrão a imitar: `tech-spec.md` § Lógica e § Contratos (`GET /api/console/*`)
  - Cobre: FR-050, FR-051, FR-052, FR-054, FR-061, FR-103 | Depende de: T058, T039
  - Verificação: `npx vitest run src/server/conversations/console-list.test.ts` passa
- [ ] T060 [US8] Criar as rotas de leitura e os canais SSE do console
  - Arquivos: `src/app/api/console/conversations/route.ts` (criar: `GET` com `consoleListQuery`), `src/app/api/console/conversations/[id]/route.ts` (criar: `GET` snapshot), `src/app/api/console/events/route.ts` (criar: SSE canal `console`), `src/app/api/conversations/[id]/events/route.ts` (criar: SSE da conversa; funcionário só na própria, analista em qualquer)
  - Padrão a imitar: T036
  - Cobre: FR-050, FR-051, FR-052, FR-053, FR-054, FR-059, FR-061 | Depende de: T059, T017
  - Verificação: `curl -b analyst.txt 'localhost:3000/api/console/conversations?filter=para_voce'` devolve 2 itens e `counts`; SSE do console recebe `conversation_updated` quando o funcionário manda mensagem
- [ ] T061 [US8] Construir a lista, o histórico e o painel do console
  - Arquivos: `src/hooks/useConsole.ts` (criar: lista + filtros + busca + conversa selecionada (`?c=`) + eventos dos dois canais; recarrega snapshot ao reconectar), `src/components/console/ConsoleScreen.tsx` (alterar: usa `useConsole`), `src/components/console/ConversationList.tsx` (criar: esqueleto de 5 itens; vazio "Nenhuma conversa aqui"), `src/components/console/ConversationListItem.tsx` (criar: iniciais, nome, hora ("10:05"/"agora"/"ontem"), prévia com prefixo "Nexo: " quando do agent, rótulo, contador de não lidas), `src/components/console/ConsoleFilters.tsx` (criar: "Todas", "Para você", "Com o agent", "Minhas" com contagens), `src/components/console/ConsoleSearch.tsx` (criar: placeholder "Pesquisar conversa ou chamado", filtra em tempo real), `src/components/console/ConversationHeader.tsx` (criar: avatar, nome, linha "online · <departamento> · <chamado>", modo "Aguardando atendente"), `src/components/console/TransferSummary.tsx` (criar: "Motivo", "Confiança", "Problema", "O que o agent já fez", "Chamados"), `src/components/chat/AnalystBubble.tsx` (criar: nome + "Suporte N1"/"Suporte N2"), `src/components/chat/MessageList.tsx` (alterar: variante console com `AnalystBubble` e separador "Hoje"), `src/components/console/TicketPanel.tsx` (criar: "Chamados de <nome>", "N abertos · M encerrados", seções "Desta conversa" e "Outros chamados"; vazio "Nenhum chamado"; erro "Serviço de chamados indisponível" + "Tentar de novo"), `src/components/console/TicketPanelItem.tsx` (criar: número, status, título, "<Categoria> · prioridade <x>", último evento; expandir mostra detalhe e eventos), `src/components/console/ConsoleRail.tsx` (alterar: badge = contagem de "Para você")
  - Padrão a imitar: `tech-spec.md` § UI (Console); frame `x2HBOE`
  - Cobre: FR-050, FR-051, FR-052, FR-053, FR-054, FR-059, FR-061 | Depende de: T060, T056
  - Verificação: QA do teste independente; abrir detalhe de decisão dentro do console funciona

**Checkpoint**: console lista, filtra, busca e mostra contexto.

## Fase 10 — US9: Console: assumir, responder, devolver e encerrar (P2)

**Objetivo**: ciclo completo da transferência com concorrência segura.
**Teste independente**: assumir libera o campo e muda o rótulo para "Você está atendendo"; mensagem chega ao funcionário com nome e nível; devolver reativa o agent com retomada; encerrar fecha a conversa.

- [ ] T062 [US9] Escrever o teste das ações do console (falha antes do código)
  - Arquivos: `src/server/conversations/console-actions.test.ts` (criar: `take` de `aguardando_atendente` e de `com_agent` → `com_analista` + `assigned_analyst_id` + evento "<nome> assumiu · agent pausado" + `setStatus('em_atendimento')` e nota "Assumido por <nome>" no chamado em foco; `take` concorrente: segundo recebe `already_assigned`; `return` de `aguardando_atendente` ou do próprio atribuído → `com_agent` + evento "Nexo Assist voltou" + mensagem de retomada "Voltei. Posso continuar ajudando com o <chamado>?" (ou sem chamado: "Voltei. Posso continuar ajudando?"); `return` por outro analista → `not_allowed`; `close` só pelo atribuído → `encerrada`/`encerrada_pelo_analista` + evento "Atendimento encerrado"; `sendAnalystMessage` só pelo atribuído; todas publicam `state`/`message` e `conversation_updated`)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Console: assumir/devolver/encerrar") e § Riscos (concorrência)
  - Cobre: FR-055, FR-056, FR-057, FR-058, FR-060
  - Verificação: `npx vitest run src/server/conversations/console-actions.test.ts` falha por asserção
- [ ] T063 [US9] Implementar as ações do console
  - Arquivos: `src/server/conversations/console-actions.ts` (criar: `take`, `return`, `close`, `sendAnalystMessage` com `UPDATE … WHERE` condicional em transação), `src/server/agent/templates.ts` (alterar: `resumeMessage(ticketNumber?)` com decisão)
  - Padrão a imitar: `tech-spec.md` § Lógica
  - Cobre: FR-055, FR-056, FR-057, FR-058, FR-060 | Depende de: T062, T059
  - Verificação: `npx vitest run src/server/conversations/console-actions.test.ts` passa
- [ ] T064 [US9] Criar as rotas de ação do console
  - Arquivos: `src/app/api/console/conversations/[id]/take/route.ts` (criar), `src/app/api/console/conversations/[id]/return/route.ts` (criar), `src/app/api/console/conversations/[id]/close/route.ts` (criar), `src/app/api/console/conversations/[id]/messages/route.ts` (criar: `201`, `403 not_assigned_to_you`)
  - Padrão a imitar: T036
  - Cobre: FR-055, FR-056, FR-057, FR-058, FR-060 | Depende de: T063
  - Verificação: dois `curl` concorrentes de `take` com cookies de analistas diferentes → um `200`, um `409 already_assigned`
- [ ] T065 [US9] Construir a barra de assunção, o composer do analista e os botões de ação
  - Arquivos: `src/components/console/TakeoverBar.tsx` (criar: "<nome> espera um atendente", "Agent pausado · até HH:MM" (alvo de 2 h úteis), botões "Devolver ao agent" e "Assumir atendimento" desabilitados durante a operação; composer bloqueado "Assuma o atendimento para responder"; em `com_agent`: "Assumir atendimento" apenas; em `com_analista` por outro: "Em atendimento por <nome>" sem ações), `src/components/console/ConversationHeader.tsx` (alterar: botões "Devolver ao agent" e "Encerrar atendimento" quando atribuída ao analista logado), `src/components/chat/Composer.tsx` (alterar: variante analista com placeholder "Escreva para <nome>…"), `src/hooks/useConsole.ts` (alterar: `take/return/close/send`; `409` → `Toast` "Em atendimento por <nome>"), `src/components/console/ConsoleScreen.tsx` (alterar: monta barra/composer por estado)
  - Padrão a imitar: `tech-spec.md` § UI (Console › Barra de assunção, Composer do analista); frames `x2HBOE`/`CAqx8`
  - Cobre: FR-055, FR-056, FR-057, FR-058, FR-060 | Depende de: T064, T061
  - Verificação: QA do teste independente em duas abas (funcionário e analista); segundo analista vê "Em atendimento por Rafael Lima"

**Checkpoint**: ciclo da transferência fechado.

## Fase 11 — US10: Voltar outro dia e continuar de onde parei (P2)

**Objetivo**: tudo sobrevive a reinício; conversas anteriores visíveis acima com separador; retry após reinício no meio da resposta.
**Teste independente**: conversar, parar o servidor, subir, entrar: histórico, rascunho pendente e estado intactos; conversa encerrada anterior aparece acima com "Conversa encerrada em <data> · <motivo>".

- [ ] T066 [US10] Exibir as conversas anteriores e o separador de encerramento, e cobrir o reinício
  - Arquivos: `src/components/chat/MessageList.tsx` (alterar: renderiza as conversas anteriores do snapshot, cada uma seguida de `DaySeparator` "Conversa encerrada em <dd mmm, HH:MM> · <Resolvida pelo agent | Encerrada pelo analista | Limite de mensagens>"), `src/components/chat/ChatScreen.tsx` (alterar: ao receber `conversation`, troca o canal do SSE), `src/server/conversations/service.test.ts` (criar: nova mensagem após `encerrada` abre nova conversa sem resumo herdado (exceto `limite_atingido`); mensagem com conversa `aguardando_atendente`/`com_analista` não dispara agent; `getOrOpenConversation` respeita o índice único)
  - Padrão a imitar: `tech-spec.md` § UI (Chat › Lista de mensagens) e § Lógica ("Turno do agent")
  - Cobre: FR-028, FR-029, FR-042, FR-080, FR-081 | Depende de: T035, T037
  - Verificação: `npx vitest run src/server/conversations/service.test.ts src/server/startup.test.ts` passa; QA: matar o servidor durante uma resposta → ao voltar, bolha de erro com "Tentar de novo" e mensagem do funcionário preservada

**Checkpoint**: persistência verificada por reinício.

## Fase 12 — US11: Limite de mensagens por sessão (P2)

**Objetivo**: contador visível; na 30ª, opções "Continuar em nova conversa" e "Falar com um analista"; continuação com resumo herdado.
**Teste independente**: 30 mensagens → mensagem de limite com as duas opções e campo bloqueado; "Continuar em nova conversa" abre conversa com 0/30 e o agent retoma o assunto.

- [ ] T067 [US11] Escrever e passar os testes do limite
  - Arquivos: `src/server/conversations/limit.test.ts` (criar: contam texto, opção rápida e seleção; não contam Confirmar/Cancelar nem mensagens com analista; retry não conta; na 30ª resposta o agent anexa mensagem por template "Chegamos ao limite de 30 mensagens nesta conversa." com `limit_options` e `limit_reached=true`; contador 30 sem `limit_reached` (devolvida pelo analista) → próxima mensagem recebe a mensagem de limite em vez de 409; `continue` encerra com `limite_atingido`, expira rascunho pendente, cria conversa com `previous_conversation_id`, `inherited_summary` (stub) e evento `continuada`, e o agent abre com "Continuando: …"; `transferAtLimit` transfere a atual), `src/server/conversations/limit.ts` (criar: `countsTowardLimit`, `applyLimitIfReached`, `continueInNewConversation`, `transferAtLimit`), `src/server/agent/run-turn.ts` (alterar: usa `applyLimitIfReached` antes do modelo), `src/server/agent/templates.ts` (alterar: `limitReached`, `continuationOpening(summary)`)
  - Padrão a imitar: `tech-spec.md` § Lógica ("Limite de 30 mensagens") e § Decisões D2 do PRD; achado 4
  - Cobre: FR-070, FR-071, FR-072 | Depende de: T035, T039
  - Verificação: `npx vitest run src/server/conversations/limit.test.ts` passa
- [ ] T068 [US11] Criar as rotas de continuação e de transferência no limite
  - Arquivos: `src/app/api/chat/continue/route.ts` (criar: `200 { conversationId }`, `409` se limite não atingido), `src/app/api/chat/transfer/route.ts` (criar: `200 { conversation }`, `409` se não `com_agent`)
  - Padrão a imitar: T036
  - Cobre: FR-071, FR-072 | Depende de: T067
  - Verificação: `curl -X POST -b cookie.txt localhost:3000/api/chat/continue` antes do limite → `409`
- [ ] T069 [US11] Construir o aviso de limite e o contador
  - Arquivos: `src/components/chat/LimitNotice.tsx` (criar: botões "Continuar em nova conversa" e "Falar com um analista"), `src/components/chat/Composer.tsx` (alterar: bloqueio com texto "Limite de 30 mensagens atingido. Escolha uma opção acima."; Confirmar/Cancelar do rascunho continuam ativos), `src/hooks/useChat.ts` (alterar: `continueConversation`, `transferAtLimit`; troca de canal ao receber `conversation`), `src/components/console/ConversationListItem.tsx` (alterar: rótulo "Encerrada · limite de mensagens"), `src/components/console/TransferSummary.tsx` (alterar: mostra `inherited_summary` no topo de conversa continuada)
  - Padrão a imitar: `tech-spec.md` § UI (Composer, Opções rápidas) e § Decisões D2
  - Cobre: FR-070, FR-071, FR-072 | Depende de: T068, T037, T061
  - Verificação: QA: com `AGENT_MESSAGE_LIMIT=3` no `.env`, 3 mensagens → aviso; "Continuar" abre nova conversa com 0/3 e abertura "Continuando: …"; console mostra a anterior "Encerrada · limite de mensagens"

**Checkpoint**: limite e continuação funcionam.

## Fase 13 — US12: Meu perfil (P3)

**Objetivo**: tela somente leitura fiel ao protótipo.
**Teste independente**: "Meu perfil" mostra nome, e-mail "Gerenciado pela TI", "Senha · Alterada há 42 dias"; "Redefinir senha" mostra o aviso; "Atendimento" volta ao chat intacto.

- [ ] T070 [US12] Construir a página de perfil
  - Arquivos: `src/app/perfil/page.tsx` (criar: exige funcionário, usa `/api/me`), `src/components/chat/ProfilePage.tsx` (criar: "Seus dados de acesso ao service desk de TI.", "Nome", "E-mail corporativo" + "Gerenciado pela TI", "Senha" + "Alterada há N dias", botão "Redefinir senha" → `Toast` "Indisponível neste protótipo. Fale com a TI no ramal 4000.", texto "Enviaremos um link de redefinição para <e-mail>."), `src/components/chat/EmployeeSidebar.tsx` (alterar: item ativo por rota)
  - Padrão a imitar: `tech-spec.md` § UI (Perfil); frame `i4fCbC`
  - Cobre: FR-090 | Depende de: T028
  - Verificação: QA do teste independente

**Checkpoint**: todas as histórias entregues.

## Fase 14 — Compatibilidade

- [ ] T071 Testar a leitura tolerante de partes ricas e decisões (mitigação do item f)
  - Arquivos: `src/server/messages/repo.test.ts` (criar: linha com `parts` sem `quick_options`, com campo desconhecido e com JSON inválido → mensagem carrega com partes vazias e aviso no log; decisão com `steps` sem `attempts` → `attempts=1`)
  - Padrão a imitar: `tech-spec.md` § Compatibilidade (f)
  - Mitiga: compat-f | Cobre: FR-053, FR-031 | Depende de: T018
  - Verificação: `npx vitest run src/server/messages`
- [ ] T072 Verificar recriação e rollback dos bancos (mitigações dos itens c e h)
  - Arquivos: `scripts/db-reset.ts` (alterar: flag `--keep-tickets` opcional; mensagem final com contagens), `README.md` (criar: seção "Resetar dados e desfazer" com `npm run db:reset`, `TICKETS_OUTAGE_RATE=0`, `AGENT_CONFIDENCE_THRESHOLD`)
  - Padrão a imitar: `tech-spec.md` § Compatibilidade (c, h)
  - Mitiga: compat-c, compat-h | Cobre: FR-105 | Depende de: T021
  - Verificação: `npm run db:reset && npx vitest run src/server/seed` passa duas vezes seguidas

## Fase 15 — Polimento

- [ ] T073 Fechar o relatório de custo e a tabela de preços
  - Arquivos: `scripts/cost-report.ts` (criar: por conversa e total: tokens de entrada/saída/cache, `cost_usd` estimado com a tabela paga, duração p50/p95, taxa de `decision_missing`; nota "free tier: cobrado R$ 0"), `src/server/agent/pricing.ts` (alterar: expõe `PRICES` para o relatório)
  - Padrão a imitar: `tech-spec.md` § Observabilidade (métricas)
  - Cobre: SC-005, SC-009 | Depende de: T035
  - Verificação: `npm run cost-report` imprime tabela com pelo menos as conversas do QA
- [ ] T074 Revisar logs e estados de erro/vazio em todas as telas
  - Arquivos: `src/server/agent/run-turn.ts` (alterar: todos os eventos da lista de § Observabilidade logados), `src/server/conversations/transfer.ts` (alterar: `transfer` logado), `src/server/tickets/outage.ts` (alterar: `tickets_outage_started`), `src/components/console/TicketPanel.tsx` (alterar: estado de erro com "Tentar de novo" testado com `TICKETS_OUTAGE_RATE=1`), `src/components/chat/MessageList.tsx` (alterar: esqueleto durante o carregamento inicial)
  - Padrão a imitar: `tech-spec.md` § Observabilidade e § UI (estados)
  - Cobre: FR-026, FR-054, SC-004 | Depende de: T061, T065, T066, T067
  - Verificação: `npm run dev` com `TICKETS_OUTAGE_RATE=1`: painel mostra erro e recupera com `0`; `grep -c '"event":' <log>` cobre os eventos listados
- [ ] T075 Escrever o README completo
  - Arquivos: `README.md` (alterar: como rodar em 3 comandos (`cp .env.example .env` + chave do AI Studio, `npm install`, `npm run dev`), contas de exemplo por perfil, visão da arquitetura com o diagrama de camadas, como o agent decide (ferramentas, `record_decision`, pós-ações em código, limiar), como a qualidade foi garantida (suíte: resultado de `eval/report.md`, testes), modelo escolhido e por quê (Gemini 3.5 Flash-Lite, free tier, cota, alternativa 3.8 Flash, aviso sobre uso de dados no free tier), custo médio por conversa (`npm run cost-report`), trade-offs (T1–T13 em linguagem de produto), o que faria com mais tempo (deploy, Playwright, roteamento N1/N2, feriados), comandos `db:reset`/`eval`/`test`)
  - Padrão a imitar: PDF § Entregáveis (itens do README)
  - Cobre: SC-007, SC-009 | Depende de: T073, T072
  - Verificação: terceiro segue o README do zero em máquina limpa e chega ao chat com 3 comandos
- [ ] T076 Rodar a suíte completa de avaliação e commitar o relatório
  - Arquivos: `eval/report.md` (gerar), `src/server/agent/instructions.ts` (alterar, se preciso)
  - Padrão a imitar: T038
  - Cobre: SC-001, SC-003, SC-004 | Depende de: T055, T053, T040, T049, T038
  - Verificação: `npm run eval` ≥ 90% nos 24 cenários; 0 vazamentos; 100% com decisão

## Fase 16 — Verificação final

- [ ] T077 Rodar verificação completa do repo
  - Verificação: `npm run lint && npm run typecheck && npm test && npm run build && npm run eval`
- [ ] T078 Autorrevisão do diff contra a base
  - Verificação: `git diff --stat $(git rev-list --max-parents=0 HEAD) HEAD` só com arquivos da lista `## Arquivos` da `tech-spec.md`; nenhum teste alterado fora do declarado (T055); sem `catch` vazio; sem `any` fora de testes; sem `console.log` de depuração (só `logger`); sem segredo (`grep -rn 'AIza' src eval scripts` vazio); `tickets/db.ts` importado só em `src/server/tickets/`; nenhuma regra de negócio em SQL
- [ ] T079 QA manual
  - Verificação: (1) Caminho feliz: entrar como `ana.souza@nexo.com.br`; "Meu notebook não conecta na VPN desde ontem. Erro 809."; "Só eu"; conferir passos "consultou seus chamados", "buscou na central de ajuda", "classificou a prioridade", "consultou o SLA", "montou o rascunho"; rascunho Rede e VPN / Alta / prazo; "Confirmar" → `INC-…`; abrir detalhe; em outra aba, `rafael.lima@nexo.com.br` → "Com o agent" lista Ana; "Assumir atendimento"; responder; "Devolver ao agent"; ver retomada no chat da Ana; "Encerrar atendimento" após assumir de novo. (2) Borda: `TICKETS_OUTAGE_RATE=1` → "Confirmar" falha com aviso e rascunho pendente; voltar a `0.1` → um único chamado; `AGENT_MESSAGE_LIMIT=3` → aviso de limite → "Continuar em nova conversa" → 0/3 e resumo herdado; reiniciar o servidor no meio de uma resposta → "Tentar de novo"; "qual o status do INC-20519?" → "Não encontrei esse chamado entre os seus".

## Dependências e ordem

- Fase 1 → bloqueia Fases 2+. Dentro da fundação: T002 → T003/T004 ‖; T005 ‖ T006 → T007 → T011/T015/T018 → T020 → T021/T023; T008 ‖ T010 ‖ T012 ‖ T014 ‖ T016 ‖ T019 ‖ T022 ‖ T024 podem começar logo após T002.
- US1 (Fase 2) → US2 (Fase 3) usa a casca do chat; US3 (Fase 4) usa o turno de US2 e depende de T039 (Fase 5) para o caso crítico: executar T039 antes de T045.
- US4, US5 usam ferramentas e rascunhos de US2/US3. US6 só precisa de US2. US8 precisa de T039; US9 de US8; US11 de T039 e T035; US10 e US12 só da Fase 2/3.
- Paralelo seguro: [T003 ‖ T004 ‖ T008 ‖ T010 ‖ T012 ‖ T014 ‖ T016 ‖ T019 ‖ T022 ‖ T024], [T005 ‖ T006], [T027 ‖ T028 ‖ T029], [T030 ‖ T031 ‖ T032], [T056 ‖ T058], [T070 ‖ T071].

## Rastreabilidade

| FR | Tasks |
|----|-------|
| FR-001 | T014, T015, T025, T027, T028 |
| FR-002 | T014, T015, T025, T027 |
| FR-003 | T010, T011, T032, T033, T050, T051, T053 |
| FR-004 | T014, T015, T026, T029 |
| FR-005 | T014, T015, T025, T028 |
| FR-010 | T016, T017, T035, T036, T037 |
| FR-011 | T017, T031, T034, T035, T036, T037 |
| FR-012 | T030, T034, T035, T038 |
| FR-013 | T012, T013, T030, T032, T033, T038 |
| FR-014 | T030, T033, T038 |
| FR-015 | T033, T034, T042, T044, T048 |
| FR-016 | T032, T042, T043, T044, T045, T046, T047, T054, T055 |
| FR-017 | T008, T009, T032, T042, T044 |
| FR-018 | T008, T009, T044, T054, T055 |
| FR-019 | T050, T051, T052, T053 |
| FR-020 | T032, T050, T051, T052, T053 |
| FR-021 | T008, T009, T050, T051, T053 |
| FR-022 | T034, T050, T051, T053 |
| FR-023 | T037, T047, T052 |
| FR-024 | T032, T042, T043, T044, T045, T046, T047, T048 |
| FR-025 | T005, T018, T032, T043, T045 |
| FR-026 | T004, T006, T010, T011, T043, T045, T046, T047, T074 |
| FR-027 | T031, T035, T036, T037 |
| FR-028 | T005, T018, T031, T034, T035, T066 |
| FR-029 | T030, T031, T033, T034, T035, T037, T066 |
| FR-030 | T018, T031, T032, T033, T034, T056, T057 |
| FR-031 | T056, T071 |
| FR-032 | T031, T034, T040 |
| FR-040 | T031, T042, T044, T040, T050, T051 |
| FR-041 | T039, T040 |
| FR-042 | T035, T039, T041, T066 |
| FR-043 | T017, T024, T028, T036, T041 |
| FR-044 | T042, T043, T045, T048 |
| FR-050 | T024, T058, T059, T060, T061 |
| FR-051 | T016, T058, T059, T060, T061 |
| FR-052 | T016, T058, T059, T060, T061 |
| FR-053 | T024, T037, T060, T061, T071 |
| FR-054 | T059, T060, T061, T074 |
| FR-055 | T062, T063, T064, T065 |
| FR-056 | T062, T063, T064, T065 |
| FR-057 | T062, T063, T064, T065 |
| FR-058 | T062, T063, T064, T065 |
| FR-059 | T017, T060, T061 |
| FR-060 | T062, T063, T064, T065 |
| FR-061 | T059, T060, T061 |
| FR-070 | T005, T035, T067, T069 |
| FR-071 | T031, T067, T068, T069 |
| FR-072 | T067, T068, T069 |
| FR-080 | T005, T007, T018, T022, T023, T066 |
| FR-081 | T018, T022, T023, T066 |
| FR-090 | T070 |
| FR-100 | T006, T010, T011 |
| FR-101 | T013, T019, T020 |
| FR-102 | T010, T011 |
| FR-103 | T008, T009, T058, T059 |
| FR-104 | T019, T020 |
| FR-105 | T019, T021, T072 |

| Mitigação | Task |
|-----------|------|
| compat-c (dado local: recriação por `db:reset`, migrations aditivas) | T072 |
| compat-f (parsing defensivo de `parts`/`steps`) | T071 |
| compat-h (rollback: `db:reset`, flags de ambiente, documentado) | T072, T075 |

## Decisões

- X1 — Um commit por rodada (template da skill) ou um commit por fase, seguindo o plano da tech spec? → Um commit por fase, com as mensagens da seção `## Commit` — decidido pelo autor: o PDF avalia "commits que contem a história do desenvolvimento"; um commit único jogaria fora um critério explícito. Deploy continua fora.
- X2 — Escopo da rodada: só P1 ou todas as histórias? → Todas (US1–US12), na ordem P1 → P2 → P3, com a Fase 4 (transferência, parte de US7) adiantada por dependência do caso crítico de US3 — decidido pelo autor: o desafio é entregue inteiro; o checkpoint de MVP (fim da Fase 2) e o de núcleo (fim da Fase 3) permitem cortar se faltar tempo.
- X3 — Aplicação de migrations: pela implementação ou pelo usuário? → O `startup.ts` aplica em bancos locais e os testes em bancos temporários; não há ambiente compartilhado — decidido pelo autor: é o desenho da tech spec (T5) e não viola a regra de não aplicar migration em ambiente de terceiros.

## Commit

Um commit por fase, nesta ordem (Conventional Commits, sem número de card porque não há issue):

```
chore: scaffold Next.js 16, TypeScript estrito, Tailwind e Vitest            (T001–T004, T024)
feat(db): schemas Drizzle, migrations e subida do servidor                   (T005–T007, T018, T022, T023)
feat(tickets): módulo de chamados com banco próprio, idempotência e falha simulada (T010, T011)
feat(rules): prioridade, SLA, horas úteis e janela de reabertura com testes  (T008, T009, T012, T013)
feat(auth): login por perfil, cookie HMAC e proxy                            (T014–T017, T025–T029)
feat(seed): dados de exemplo com datas relativas e conversas prontas         (T019–T021)
feat(agent): Agent Mastra, ferramentas, record_decision e turno em streaming (T030–T038)
feat(transfer): transferência de conversa e estado no chat                   (T039–T041)
feat(drafts): rascunho, confirmar/cancelar/editar e caso crítico             (T042–T049)
feat(tickets-chat): status, card com prazo vencido e privacidade             (T050–T055)
feat(transparency): bloco de detalhe da decisão                              (T056, T057)
feat(console): lista, filtros, assumir/devolver/encerrar e painel de chamados (T058–T065)
feat(limit): limite de 30 mensagens e continuação com resumo                 (T066–T070)
test(eval): suíte de avaliação, relatório e compatibilidade                  (T071–T074, T076)
docs: README com execução, arquitetura, decisões e custo                     (T075, T077–T079)
```

Cada mensagem termina com a linha de atribuição exigida nesta sessão:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```
