# Tech Spec: Nexo Assist — agent do service desk de TI

**PRD**: `prd.md` | **Card**: Desafio Técnico "Nexo Assist" (PDF v5) | **Repo**: `desafio` (greenfield, sem git ainda) | **Base**: a criar (`main`) | **Data**: 2026-10-26 | **Status**: Aprovado (T1–T8 decididas em 2026-10-26)

## Resumo

Um único projeto Next.js 16 (App Router) na raiz do repositório concentra interface, API e o agent (T3). O agent é um `Agent` do Mastra com ~11 ferramentas tipadas em zod e uma ferramenta obrigatória `record_decision`; o servidor envolve cada turno, aplicando limite de mensagens, gatilhos de transferência e privacidade em código (T1). Modelo: Google Gemini 3.5 Flash-Lite pelo roteador do Mastra, com `GEMINI_API_KEY`/`GEMINI_MODEL` iguais ao projeto `sendEmailJobs` (T2). O serviço de chamados é um módulo isolado atrás da interface `TicketService`, com banco SQLite próprio e indisponibilidade simulada (T4). Persistência em SQLite via Drizzle + `@libsql/client`, dois arquivos (T5). Tempo real por SSE com barramento interno (T6). Interface em Tailwind v4 com os tokens do protótipo e componentes próprios (T7). Testes com Vitest nas regras, no módulo de chamados e nas transições, mais uma suíte de avaliação do agent com modelo real (T8).

## Premissas técnicas

- Deploy fica fora desta iteração (decisão do usuário no PRD). Nada de plataforma, limite por IP ou proteção de chave em nuvem; só execução local.
- `prd.md` e `tech-spec.md` não entram nos commits: adicionar em `.git/info/exclude` logo após `git init`.
- Ambiente verificado em 2026-10-26: Node v24.20.0, npm 11.19.0, git 2.43.0, Docker 29.9.2, sqlite3 3.50.6; `pnpm`, `yarn`, `bun` e `psql` ausentes. Gerenciador de pacotes: npm (workspaces nativos). Docker não será exigido para rodar.
- `node:sqlite` (módulo nativo do Node 24) está disponível (`DatabaseSync` carregou sem erro); considerado como opção zero-dependência em T5.
- TypeScript em modo estrito (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes` avaliado na implementação). Textos de interface e do agent em pt-BR; identificadores de código em inglês.
- Versões publicadas no npm em 2026-10-26 (consultadas com `npm view`): next 16.4.3, react 19.3.1, @mastra/core 1.79.0, @mastra/libsql 1.27.0, @langchain/langgraph 1.5.2, @langchain/anthropic 1.6.0, @anthropic-ai/sdk 1.3.0, ai 7.0.153, @ai-sdk/anthropic 4.0.88, drizzle-orm 0.45.4, drizzle-kit 0.31.11, @libsql/client 0.18.0, better-sqlite3 13.0.3, vitest 5.0.5, tailwindcss 4.3.3, zod 4.6.7, typescript 7.0.2, lucide-react 1.61.0, concurrently 10.0.6, hono 4.13.14. A implementação fixa versões exatas no `package.json` no momento do `npm install`.
- Regras de negócio moram no código do servidor (serviços TypeScript testáveis), nunca só no prompt: prioridade, prazo, limite de mensagens, gatilhos de transferência, privacidade e idempotência do "Confirmar" são aplicados por código mesmo que o modelo erre.
- O modelo nunca escreve diretamente no serviço de chamados: ele propõe (rascunho) e o servidor executa após "Confirmar".
- Chave do provedor de LLM só em `.env` (fora do código), com `.env.example` versionado.
- Provedor: Google Gemini pelo roteador de modelos do Mastra, modelo padrão `google/gemini-3.5-flash-lite`. Variáveis com os mesmos nomes de `/home/caio/Documentos/dev/sendEmailJobs/backend/.env.example` (`GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-3.5-flash-lite`), para o usuário reaproveitar a chave que já tem; o módulo `env.ts` valida as duas e as entrega ao Mastra (prefixando `google/` no id). Alternativa `gemini-3.8-flash` documentada no README para quem tiver cota. Preços de referência (API Google, 2026-10-26, por milhão de tokens): Gemini 3.8 Flash grátis no free tier; pago $0,75 entrada / $3,75 saída (sobe para $1,50 / $7,50 em 2027-01-01); Gemini 3.5 Flash-Lite grátis no free tier, pago $0,30 / $2,50; Gemini 3.1 Pro Preview e Gemini 4 Argon sem free tier. Opções do provedor via `providerOptions.google`: `thinkingConfig.thinkingLevel` (`minimal`/`low`/`medium`/`high`), `cachedContent`, `safetySettings`, `structuredOutputs`. O custo por decisão (SC-009) é calculado com a tabela paga, com a observação de que no free tier o valor cobrado é zero.

## Pesquisa

Não existe código no repositório. A "pesquisa" cobre o que existe: o PDF do desafio, o protótipo Pencil e o ambiente local. Tudo que normalmente seria "padrão a imitar" vira decisão explícita (T1, T3, T4, T5, T6, T7).

### a. Arquivos e funções envolvidos

- `/home/caio/Documentos/dev/desafio/Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf` — páginas 2–3: requisitos técnicos (TypeScript estrito; Mastra preferido ou LangGraph.js; qualquer provedor com justificativa no README; Next.js/React sugeridos; serviço de chamados simulado e separado; persistência a reinício; poucos comandos + `.env.example`), "também esperamos" (arquitetura clara, testes onde fazem diferença, tratamento de erros, commits que contam a história, eficiência/custo por conversa, chaves fora do código, privacidade) e critérios de avaliação.
- `/home/caio/Documentos/dev/desafio/prd.md` — 57 FRs (FR-001…FR-105), RN-001…RN-011, SC-001…SC-009, decisões D1–D9, premissas.
- `/home/caio/Downloads/nexo.pen` (lido via MCP Pencil) — 6 frames: `bi8Au` login (1440×900; `qwYXO` Showcase 800 + `ruatt` Sign In 640), `IcuoM` chat novo chamado (`BUfyu` Sidebar 232 + `H1zU9` Main 1208: `BrfaG` Top Bar 64, `dwgwA` Chat), `vbsNW` chat consulta/transferência (mesma estrutura), `x2HBOE` console conversas (`I20l4G` Rail 64 + `zqcY8` Chat List 380 + `K8Fy6` Conversation 656 + `n9znN` Ticket History 340), `CAqx8` console assumido (1567 de largura; Conversation 783), `i4fCbC` meu perfil (`JmKVw` Page).
- Tokens do protótipo (`GetVariables()`): cores `paper #FFFFFF`, `desk #F6F7F9`, `ink #1B2431`, `ink-2 #3D4656`, `ink-3 #5B6472`, `rule #E6E8EC`, `cta #0062C4`, `primary #0285F7`, `primary-soft #0285F712`, `primary-text #0069C7`, `success #00BD6C`/`success-soft`/`success-text #00804A`, `warning #F5A500`/`warning-text #946300`, `danger #EE343B`/`danger-text #C4161D`, `violet #A37AFF`; fontes `font-ui "Schibsted Grotesk"` (342 usos), `font-display "Newsreader"` (5 usos), `font-data "IBM Plex Mono"`; tamanhos predominantes 12.5 / 13.5 / 14.5 / 15.5 / 11; raios 6, 8, 12, 16 e 999 (pílulas); bolhas com raio assimétrico `[12,12,4,12]` (funcionário) e `[4,12,12,12]` (agent).
- Export HTML/Tailwind das 6 telas para consulta na implementação: `/tmp/claude-1000/-home-caio-Documentos-dev-desafio/6e10dce0-d32e-45d3-b9d9-98294161db84/scratchpad/screens-html/nexo-screens.html` (395 KB; textos exatos extraídos e usados na seção UI abaixo). Temporário: a implementação deve reexportar via MCP se o arquivo sumir.

### b. Fluxo atual

Não há fluxo implementado. O fluxo alvo (do PRD) é: tela de login → sessão por perfil → chat do funcionário → mensagem → agent decide (ferramentas: chamados, central de ajuda, SLA) → resposta em streaming com passos → rascunho → "Confirmar" → serviço de chamados → card atualizado; transferência → console do analista → assumir/devolver/encerrar → funcionário vê em tempo real.

### c. Padrão a imitar

- Nenhum no repositório. Padrões externos adotados por decisão: estrutura de projeto gerada por `create-next-app` (T3), convenções de agent/tools da documentação do Mastra 1.x (T1), schema declarativo do Drizzle (T5). A ausência de padrão interno está declarada aqui e resolvida pelas decisões T1–T8.

### d. Helpers e serviços reutilizáveis

- Nenhum no repositório. Da plataforma: `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` (Node 24 tem ICU completo) para o cálculo de horas úteis sem biblioteca de datas; `node:crypto` (`createHmac`, `timingSafeEqual`) para assinar o cookie de sessão; `ReadableStream` nativo para SSE nos route handlers.
- Do Mastra 1.79 (documentação consultada em 2026-10-26): `Agent` de `@mastra/core/agent` (`id`, `name`, `instructions` estática ou função de `requestContext`, `model: "anthropic/<modelo>"`, `tools`); `createTool` de `@mastra/core/tools` (`id`, `description`, `inputSchema`, `outputSchema`, `execute(inputData, context)` onde `context.requestContext` traz o contexto por requisição); `RequestContext` de `@mastra/core/request-context` (`new RequestContext()`, `.set(k, v)`, passado como opção `requestContext` em `generate`/`stream`); `agent.stream(messages, opts)` retorna `MastraModelOutput` com `fullStream` (chunks `start`, `text-start/delta/end`, `tool-call`, `tool-result`, `step-start/finish`, `finish`), `textStream`, `usage` (`inputTokens`, `outputTokens`, `cachedInputTokens`), `finishReason`, `toolCalls`, `toolResults`; opções relevantes: `maxSteps`, `toolChoice` (`'auto'` padrão, `'required'`, `{type:'tool', toolName}`), `onStepFinish`, `onFinish`, `abortSignal`, `providerOptions.anthropic` (`thinking`, `effort`, `cacheControl`), `modelSettings` (`maxOutputTokens`, `timeout`), `structuredOutput` (não combinável com ferramentas de forma garantida: "some models may not support using both features together"). Chave lida da variável do provedor (Google: `GOOGLE_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY`) ou passada explicitamente na forma de objeto `model: { id: "google/gemini-3.5-flash-lite", apiKey }`; `model` também aceita array de fallback `[{ model, maxRetries, providerOptions }]` (tenta o próximo em 500, limite de taxa ou timeout), usado aqui com uma entrada e `maxRetries` para absorver 429 do free tier.
- Do Next.js 16.4: `proxy.ts` (antigo `middleware.ts`, renomeado na v16.0.0; runtime Node por padrão; `export function proxy(request: NextRequest)` + `config.matcher`) para redirecionamento por perfil.

### e. Testes existentes na área

- Sem teste na área (sem código). A estratégia está em "Estratégia de testes".

### f. Dependentes e contratos compartilhados

- Callers: nenhum.
- Contratos com outros repos: nenhum. Contratos internos entre pacotes do mesmo repositório: tipos do serviço de chamados compartilhados em um pacote `shared` (ver "Contratos"). Não precisa de card externo.

### g. Estado do dado

| Tabela | Colunas relevantes | Políticas de acesso | Migrations existentes |
|--------|--------------------|---------------------|-----------------------|
| (nenhuma) | — | — | nenhuma; schema inicial definido em "Dados" |

## Gate de regras do repo

Não há `CLAUDE.md` no projeto (só o global do usuário, que trata de `rtk` e não afeta o desenho). As regras inegociáveis vêm do PDF e das restrições do usuário.

| Regra | Fonte | Como o desenho cumpre |
|-------|-------|-----------------------|
| TypeScript com tipagem estrita | PDF, Requisitos técnicos | `strict: true` em todos os `tsconfig`; schemas zod geram tipos; sem `any` fora de testes |
| Agent em Mastra (preferência) ou LangGraph.js | PDF, Requisitos técnicos | Mastra 1.x: `Agent` + `createTool` (T1); regras de negócio fora do modelo, em serviços do servidor |
| Qualquer provedor de LLM, justificado no README | PDF, Requisitos técnicos | Google Gemini via Mastra (`google/gemini-3.5-flash-lite`, T2), chave em `GEMINI_API_KEY` e modelo em `GEMINI_MODEL` (mesmos nomes do projeto `sendEmailJobs` do usuário); seção "Modelo" do README explica: free tier (avaliador roda sem pagar), cota diária maior que a do 3.8 Flash, 1M de contexto, function calling, latência baixa |
| Interface segue o protótipo (sugestão Next.js/React) | PDF, Requisitos técnicos; Anexo C | Next.js 16 App Router único para UI + API + agent (T3); Tailwind v4 com tokens do `.pen` em `@theme`, componentes próprios e `lucide-react` (T7); fontes Schibsted Grotesk, Newsreader e IBM Plex Mono por `next/font/google`; mapeamento bloco a bloco na seção UI |
| Serviço de chamados simulado, separado do agent | PDF, Requisitos técnicos | Módulo isolado `src/server/tickets/` atrás da interface `TicketService` (T4), com banco SQLite próprio (`data/tickets.db`) aberto só por ele; o agent e o console só acessam pela interface; indisponibilidade simulada dentro do módulo |
| Conversas, chamados e estado sobrevivem a reinício | PDF, Requisitos técnicos; FR-080 | SQLite em arquivo via Drizzle + `@libsql/client` (T5), dois bancos (`data/app.db`, `data/tickets.db`) com WAL; tudo persistido em disco antes de responder ao cliente |
| Rodar localmente com poucos comandos + `.env.example` | PDF, Requisitos técnicos; SC-007 | 3 comandos: `cp .env.example .env`, `npm run setup`, `npm run dev` (um único processo) |
| Chaves fora do código | PDF, Segurança | `.env` ignorado pelo git; `.env.example` sem valores reais; leitura só via `process.env` em um módulo `env.ts` validado com zod |
| Chamados de um funcionário nunca expostos a outro | PDF, Segurança; FR-003; RN-006 | identidade vem da sessão, nunca do modelo: `requestContext` injeta `employeeId` nas ferramentas; o serviço de chamados filtra por solicitante; o console só é acessível ao perfil `analista` |
| Limite de 30 mensagens por sessão | PDF; FR-070–FR-072; D2 | contador no servidor (`conversations.agent_message_count`), checado antes de chamar o modelo |
| Rascunho antes de criar/atualizar/reabrir | Anexo A; FR-016; SC-002 | o modelo não tem ferramenta de escrita no serviço de chamados; só `propose_draft`; escrita acontece em `POST /api/drafts/:id/confirm` |
| Transparência: passos acima da resposta + detalhe | PDF, item 7; FR-011, FR-030, FR-031 | cada chamada de ferramenta vira passo persistido e publicado por SSE enquanto acontece (T6); ferramenta obrigatória `record_decision` grava entendimento/ação/confiança/porquê/regras |
| Testes onde fazem diferença; tratamento de erros; commits que contam a história | PDF, "Também esperamos" | testes unitários das regras, integração do serviço de chamados e suíte de avaliação do agent; erros nunca engolidos (passo marcado como falho + log); plano de commits em `/tasks` |
| Eficiência e custo por conversa | PDF, "Também esperamos"; SC-005; SC-009 | streaming desde o primeiro passo; cache de prompt no sistema/ferramentas; uso de tokens gravado por decisão e reportado |
| Não editar código, não criar branch, não rodar migration nesta fase; não ler `.env` | skills `/prd` e `/tech-spec`; usuário | esta spec só desenha; nada foi executado |

## Abordagens consideradas

| Abordagem | Resumo | Prós | Contras | Escolhida? |
|-----------|--------|------|---------|------------|
| Framework do agent | A: Mastra `Agent` + ~10 tools, `record_decision` obrigatória, servidor envolve o turno · B: LangGraph.js `StateGraph` com nós entender/rotear/ferramentas/responder · C: Mastra Workflow + Agent | A: preferência do PDF, rastro de tools e `usage` prontos, `requestContext` para privacidade, menos código · B: grafo visível, roteamento em código · C: grafo no framework preferido | A: ordem das tools decidida pelo modelo, fallback se faltar `record_decision` · B: não é a preferência, 2 chamadas por turno, checkpointer duplica persistência · C: duas abstrações, storage do Mastra obrigatório | A (T1) |
| Provedor e modelo | A: Claude Opus 5.5 · B: Claude Sonnet 5.5 · C: Claude Haiku 5.5 · D: outro provedor (escolhido: Google Gemini 3.5 Flash-Lite, free tier) | A–C: documentação verificada, melhor julgamento (A); D: custo zero no desenvolvimento, na suíte de avaliação e para o avaliador rodar; 1M de contexto; thinking configurável | A–C: custo por conversa $0,01–$0,41 e exige chave paga do avaliador; D: limites de taxa do free tier (RPM/RPD), dados do free tier usados pelo Google para melhorar produtos (só dados de exemplo aqui) | D (T2) |
| Forma da aplicação | A: Next.js 16 único (páginas + `app/api/**/route.ts` + agent em `src/server/**`, `proxy.ts` por perfil) · B: Vite SPA + API Hono separada · C: Next.js UI + API Hono separada | A: um processo e uma porta, sugestão do PDF, SSR da primeira carga, Mastra documentado para Next, barramento de eventos no mesmo processo do banco · B: API isolada e leve · C: SSR + API isolada | A: SSE em route handler exige `force-dynamic` e singleton em `globalThis` no HMR · B: 3 processos, CORS/cookie entre portas, tipos duplicados, sem SSR · C: soma os contras | A (T3) |
| Fronteira do serviço de chamados | A: processo HTTP separado (Hono, porta própria, `data/tickets.db`) · B: módulo in-process atrás da interface `TicketService`, banco próprio, falha simulada por exceção · C: `worker_threads` | A: separação física demonstrável, 503 real · B: 1 processo, sem HTTP nem dependência extra, testes rápidos, interface permite extrair para processo depois · C: processo lógico sem porta | A: 2 processos e porta extra · B: separação só por fronteira de módulo e de banco; falha simulada é artificial · C: contrato ad hoc | B (T4) |
| Persistência | A: Drizzle ORM + `@libsql/client`, SQLite em arquivo, `drizzle-kit` para migrations · B: `node:sqlite` nativo com SQL à mão · C: Postgres via Docker + Drizzle | A: tipos do schema, migrations versionadas, sem Docker, índices únicos parciais · B: zero dependência · C: próximo de produção | A: 3 dependências · B: sem tipos derivados, módulo experimental, migrador próprio · C: Docker como pré-requisito do avaliador | A (T5) |
| Tempo real | A: SSE em route handlers (`GET …/events` + comandos por `POST`), `EventSource` nativo · B: WebSocket com servidor customizado · C: polling 1–2 s | A: sem dependência, funciona em `next dev`, reconexão nativa, snapshot na reconexão resolve recarregar no meio do streaming · B: bidirecional · C: simples | A: heartbeat e `force-dynamic`; limite de 6 conexões HTTP/1.1 (1 por aba) · B: perde `next dev` padrão, dependência, replay à mão · C: texto não progressivo | A (T6) |
| Camada visual | A: Tailwind v4 + tokens em `@theme` + componentes próprios + `lucide-react` · B: CSS Modules puro · C: Tailwind + shadcn/ui (Radix) | A: tokens 1:1 com o protótipo, 1 dependência extra, iteração rápida · B: zero dependência · C: acessibilidade pronta | A: acessibilidade à mão, classes longas · B: mais CSS repetido · C: dezenas de pacotes Radix e estilo a sobrescrever | A (T7) |
| Dependências de apoio e testes | A: mínimo (`vitest`, `tsx`, `prettier` + ESLint do scaffold) · B: A + Testing Library · C: A + Playwright | A: instalação leve, foco em regras, módulo de chamados e suíte do agent · B: protege componentes ricos · C: prova o fluxo inteiro | A: UI sem teste automatizado (QA manual roteirizado) · B: 3 dependências e custo alto para protótipo fixo · C: navegadores no setup, frágil em tempo | A (T8) |

## Desenho

### Arquitetura

Um processo Node (Next.js 16, porta 3000) e dois arquivos SQLite. Camadas, de fora para dentro:

1. **Interface** (`src/app/**`, `src/components/**`, `src/hooks/**`): páginas `/login`, `/chat`, `/perfil`, `/console`; cliente HTTP fino (`src/lib/api.ts`) e um hook de SSE (`useEventSource`). Nenhuma regra de negócio.
2. **API** (`src/app/api/**/route.ts`): route handlers finos; validam entrada com zod, resolvem a sessão, chamam um serviço e devolvem JSON ou SSE. Em `src/proxy.ts`, o redirecionamento por perfil.
3. **Serviços de domínio** (`src/server/conversations`, `drafts`, `messages`, `decisions`, `rules`, `help-center`, `auth`): toda regra de negócio, testável sem HTTP e sem modelo.
4. **Agent** (`src/server/agent`): `Agent` do Mastra, ferramentas, montagem de contexto e o orquestrador de turno `runTurn`. Só fala com o domínio pelos serviços e com chamados pela interface `TicketService`.
5. **Serviço de chamados** (`src/server/tickets`): interface + `LocalTicketService` + banco `tickets.db` + simulação de indisponibilidade. Única pasta que importa `tickets/db.ts` (regra de lint `no-restricted-imports`).
6. **Infra** (`src/server/db`, `events`, `logger.ts`, `env.ts`, `startup.ts`): Drizzle, barramento de eventos em `globalThis`, log JSON, variáveis validadas, migração + seed na subida.

Fluxo de uma mensagem do funcionário: `Composer` → `POST /api/chat/messages` → `runTurn` (grava mensagem, checa estado e limite, cria mensagem do agent `pending`) → `agent.stream` → cada `tool-call`/`tool-result`/`text-delta` vira evento no barramento → `GET /api/chat/events` entrega ao navegador → ao `finish`, decisão e texto são gravados e as pós-ações (transferir, encerrar, limite) rodam → eventos `state`/`message` fecham o ciclo; o console recebe os mesmos eventos por `GET /api/console/events` e `GET /api/conversations/:id/events`.

Estrutura de pastas (raiz = projeto Next; sem workspaces, T13):

```
.env.example  package.json  next.config.ts  tsconfig.json  eslint.config.mjs  vitest.config.ts
drizzle.config.app.ts  drizzle.config.tickets.ts  drizzle/app/0000_init.sql  drizzle/tickets/0000_init.sql
data/ (ignorado pelo git)  scripts/  eval/  README.md
src/proxy.ts  src/env.ts
src/app/            layout.tsx  globals.css  login/  chat/  perfil/  console/  api/**
src/components/     ui/  chat/  console/  login/
src/hooks/  src/lib/
src/server/         db/  auth/  events/  agent/  conversations/  messages/  drafts/  decisions/  rules/  help-center/  tickets/  seed/  logger.ts  startup.ts
```

### Agent

**Modelo e opções**: `new Agent({ id: "nexo-assist", name: "Nexo Assist", instructions, model: { id: \`google/${env.GEMINI_MODEL}\`, apiKey: env.GEMINI_API_KEY }, tools })`. Chamada: `agent.stream(history, { requestContext, maxSteps: 8, toolChoice: "auto", modelSettings: { temperature: 0.2, maxOutputTokens: 1024, timeout: { totalMs: 45_000 } }, providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } }, abortSignal })`. Fallback de taxa: `model` em forma de array com uma entrada e `maxRetries: 3` para absorver 429 do free tier.

**Instruções** (`src/server/agent/instructions.ts`): bloco estático (papel, regras do Anexo A resumidas por id RN-00x, política de ferramentas, formato de resposta, "nunca afirme dado de chamado ou artigo que não veio de ferramenta", "no máximo 2 perguntas de esclarecimento", "chame `record_decision` exatamente uma vez, antes do texto final") + bloco dinâmico gerado por função de `requestContext` (funcionário: nome, departamento, dispositivo/SO; agora em America/Sao_Paulo; estado da conversa; rascunho pendente em JSON; chamado em foco; resumo herdado; dica "o funcionário está editando o rascunho D-381"; mensagens restantes). O bloco estático vem primeiro para favorecer cache.

**Histórico enviado**: as mensagens da conversa atual (até 30 do funcionário + respostas), texto puro; respostas do agent recebem prefixo compacto `[ações: consultou seus chamados; montou o rascunho D-381]` para o modelo saber o que já fez sem reenviar resultados de ferramenta.

**Ferramentas** (`src/server/agent/tools/*.ts`; todas recebem `employeeId`/`conversationId` só por `requestContext`):

| Ferramenta | Rótulo do passo | Entrada (zod) | Saída / efeito | FR |
|------------|-----------------|---------------|----------------|----|
| `list_my_tickets` | "consultou seus chamados" | `{ includeResolvedDays?: number }` (padrão 30) | chamados do funcionário com `status`, datas, `deadlineAt`, `overdue` (calculado por `rules/sla.ts`) | FR-003, FR-018, FR-019, FR-103 |
| `get_ticket` | "consultou o INC-#####" + subpasso "calculou o prazo" | `{ number }` | detalhe + eventos + `sla { deadlineAt, overdue, overdueByText }`, ou `{ found: false }` se não for do funcionário | FR-003, FR-020, FR-021 |
| `search_help_center` | "buscou na central de ajuda" | `{ query }` | top 3 artigos com `conditions` e `appliesToEmployee` (servidor compara SO do funcionário) | FR-013 |
| `classify_priority` | "classificou a prioridade" + subpasso "consultou o SLA" | `{ kind, impact, blocksWork, sameDayCommitment, hasWorkaround }` | `{ priority, rule, deadlineAt, deadlineText }` por `rules/priority.ts` + `rules/sla.ts` | FR-017 |
| `propose_draft` | "montou o rascunho" / "refez o rascunho" (se substitui pendente) | `{ kind, title, description, type, category, affected, classification, targetTicket?, note?, duplicateCheck: { considered[], verdict, why } }` | cria linha em `drafts` (prioridade recalculada pelo servidor, nunca aceita do modelo), marca anterior como `substituido`, publica evento `draft`; devolve `{ draftId, displayCode, priority, deadlineAt }` | FR-016, FR-018, FR-024, FR-025 |
| `offer_options` | (sem pílula; aparece só em "Ferramentas") | `{ options: string[] (1–4) }` | parte rica `quick_options` na mensagem | FR-015, FR-023 |
| `offer_ticket_selection` | (sem pílula) | `{ numbers: string[] }` | parte rica `ticket_list` | FR-019, FR-023 |
| `show_ticket_card` | (sem pílula) | `{ number }` | parte rica `ticket_card` com dados do turno (cache por turno) | FR-020 |
| `request_transfer` | "transferiu para analista" | `{ reason: pedido\|critico\|vencido\|baixa_confianca, summary: { problem, done, tickets[], priority } }` | agenda pós-ação; em `critico` com rascunho pendente marca `pending_transfer` | FR-040, FR-041, FR-044 |
| `redirect_out_of_scope` | "redirecionou" | `{ area: RH\|Financeiro\|Facilities\|Outro, channel }` | só marca o passo | FR-014 |
| `close_as_resolved` | (sem pílula) | `{}` | pós-ação: encerra como `resolvida_pelo_agent` se não houver rascunho pendente nem transferência agendada | FR-029 |
| `record_decision` | (sem pílula) | `{ understanding: { intent, entities, assumptions[] }, action: responder_central\|consultar_chamados\|propor_chamado\|propor_atualizacao\|propor_reabertura\|transferir\|redirecionar\|pedir_esclarecimento\|encerrar_resolvida, confidence: 0–100, rationale, rules: string[] }` | grava o registro de decisão do turno | FR-012, FR-030, FR-032 |

Rótulos gerados pelo servidor fora do modelo: "criou o chamado", "atualizou o chamado", "reabriu o chamado" (fluxo de confirmação) e "transferiu para analista" quando a transferência é decidida pelo servidor (confiança baixa).

**Orquestrador de turno** (`src/server/agent/run-turn.ts`):

1. Resolve a conversa do funcionário: a não encerrada, ou cria nova (herdando resumo só quando a anterior fechou por limite).
2. Grava a mensagem do funcionário (idempotente por `client_message_id`). Se estado ≠ `com_agent`: publica e retorna (FR-042). Se `limit_reached`: 409.
3. Incrementa `agent_message_count` (não em retry) e cria a mensagem do agent com `status = pending`; publica `message`.
4. Monta `RequestContext` (`employeeId`, `conversationId`, `turnScratch`), instruções dinâmicas e histórico; chama `agent.stream`.
5. Consome `fullStream`: `tool-call` → passo iniciado (`step` publicado); `tool-result` → passo concluído com duração, resumo de entrada/saída e `ok`; `text-delta` → acumula e publica `text_delta` com coalescência de 50 ms; `finish` → `usage`.
6. Valida: `record_decision` chamada exatamente uma vez. Se não: repete o turno uma vez com lembrete em `context`; se ainda não, cria decisão de fallback (`confidence: 0`, `action: transferir`) e registra `decision_missing` no log.
7. Persiste texto, partes ricas, decisão (passos, uso, custo por `pricing.ts`), `status = done`; publica `message` final e `decision`.
8. Pós-ações, nesta ordem: encerrar como resolvida (se pedido e permitido); transferência por confiança < `AGENT_CONFIDENCE_THRESHOLD` (motivo `baixa_confianca`); transferência pedida pelo modelo (imediata ou `pending_transfer`); limite (se `agent_message_count` = 30: mensagem por template com `limit_options`, `limit_reached = true`).
9. Erro em qualquer ponto: mensagem do agent vira `error` com motivo, evento `error`; a mensagem do funcionário permanece; `POST …/retry` reexecuta sem nova contagem.

**Mensagens por template (sem modelo)**: confirmação de chamado criado/atualizado/reaberto; aviso de transferência ao funcionário; retomada ao devolver ("Voltei. Posso continuar ajudando com o INC-20311?"); limite atingido; abertura da conversa continuada (esta usa `summarize.ts`, uma chamada ao modelo com `structuredOutput` e sem ferramentas). Cada uma gera `agent_decisions` com `rules` e `confidence: 100`, para o bloco de detalhe sempre existir (SC-004).

**Suíte de avaliação** (`eval/`): cenários em `eval/scenarios/*.ts` (`{ id, title, employeeEmail, fixtures: { tickets[] }, turns: [{ user, expect: { action, draft?: { type, category, priority }, transfer?: reason|false, noTicket?: true, articleId?, options? } }] }`), executados em série por `eval/run.ts` contra bancos temporários (seed + fixtures), `LocalTicketService` com `TICKETS_OUTAGE_RATE=0`, chamando `runTurn` direto; asserções determinísticas sobre a decisão e os rascunhos; pausa `EVAL_DELAY_MS` entre turnos e retry em 429; saída em `eval/report.md` (acertos por categoria, confiança média, tokens, custo estimado, p95 de duração). Mínimo 20 cenários cobrindo a lista de SC-001.

### Dados

Motor: SQLite em arquivo via Drizzle ORM + `@libsql/client` (T5). Dois bancos: `data/app.db` (schema em `src/server/db/schema.ts`) e `data/tickets.db` (schema em `src/server/tickets/schema.ts`, aberto só pelo módulo de chamados). Colunas JSON como `text` com `{ mode: "json" }` e validação zod na leitura; datas como ISO 8601 em `text`; `PRAGMA journal_mode=WAL` e `busy_timeout=5000` na abertura.

**Banco da aplicação (`app`)**

| Tabela | Colunas | Observações | FR |
|--------|---------|-------------|----|
| `users` | `id`, `name`, `email` (único), `role` (`funcionario`/`analista`), `department`, `device_model`, `device_os`, `analyst_level` (`N1`/`N2`, só analista), `password_changed_at`, `created_at` | dados de exemplo; sem senha (qualquer senha não vazia) | FR-001, FR-004, FR-090, FR-101 |
| `conversations` | `id`, `employee_id`, `state` (`com_agent`/`aguardando_atendente`/`com_analista`/`encerrada`), `outcome` (nulo/`resolvida_pelo_agent`/`encerrada_pelo_analista`/`limite_atingido`), `assigned_analyst_id`, `transfer_reason` (`pedido`/`critico`/`baixa_confianca`/`vencido`/`limite`), `transfer_confidence`, `transfer_summary` (JSON: problema, feito, chamados, prioridade, motivo), `transferred_at`, `agent_message_count`, `limit_reached` (bool), `inherited_summary` (texto), `previous_conversation_id`, `pending_transfer` (bool: crítico aguardando decisão do rascunho), `created_at`, `updated_at`, `closed_at` | índice `(employee_id, state)`; invariante "no máximo uma não encerrada por funcionário" garantida por índice único parcial `employee_id WHERE state != 'encerrada'` | FR-028, FR-041, FR-070, FR-072, FR-080 |
| `messages` | `id`, `conversation_id`, `author_type` (`funcionario`/`agent`/`analista`/`sistema`), `author_id`, `text`, `parts` (JSON: `quick_options`, `ticket_list`, `ticket_card`, `draft_id`, `limit_options`), `event_type` (`transferida`/`assumida`/`devolvida`/`encerrada`/`limite`/`continuada`/`resolvida`, só `sistema`), `decision_id`, `client_message_id` (idempotência do envio), `status` (`pending`/`done`/`error`, só agent), `counts_toward_limit` (bool), `created_at` | índice `(conversation_id, created_at)`; índice único `(conversation_id, client_message_id)` | FR-010, FR-023, FR-027, FR-053, FR-081 |
| `agent_decisions` | `id`, `conversation_id`, `message_id`, `understanding` (JSON: `intent`, `entities`, `assumptions`), `action`, `confidence` (0–100), `rationale`, `rules` (JSON array), `steps` (JSON array: `tool`, `label`, `input_summary`, `output_summary`, `duration_ms`, `ok`, `error`, `attempts`), `usage` (JSON: `input_tokens`, `output_tokens`, `cached_input_tokens`, `cost_usd`), `model`, `duration_ms`, `created_at` | um registro por resposta do agent, inclusive respostas por template (criação de chamado, retomada) | FR-030, FR-031, SC-004, SC-009 |
| `drafts` | `id`, `conversation_id`, `display_code` (`D-381`), `kind` (`novo`/`atualizacao`/`reabertura`), `status` (`aguardando_confirmacao`/`confirmado`/`cancelado`/`substituido`/`expirado`), `payload` (JSON: `title`, `description`, `type`, `category`, `priority`, `affected`, `deadline_at`, `target_ticket`, `note`, `new_priority`, `duplicate_check`), `transfer_after_decision` (bool), `resulting_ticket`, `created_at`, `decided_at` | índice único parcial `conversation_id WHERE status='aguardando_confirmacao'` (FR-025) | FR-016, FR-024, FR-025, FR-044 |
| `conversation_reads` | `conversation_id`, `analyst_id`, `last_read_at` | base do contador de não lidas | FR-050 |

**Banco do serviço de chamados (`tickets`)** — arquivo separado, só o serviço de chamados o abre.

| Tabela | Colunas | Observações | FR |
|--------|---------|-------------|----|
| `tickets` | `number` (PK, `INC-#####`/`REQ-#####`), `kind` (`INC`/`REQ`), `title`, `description`, `category`, `priority`, `affected`, `requester_email`, `status` (`aberto`/`em_andamento`/`aguardando_analista`/`em_atendimento`/`aprovado`/`resolvido`), `created_at`, `updated_at`, `resolved_at` | índice `(requester_email, status)` | FR-100, FR-101 |
| `ticket_events` | `id`, `ticket_number`, `kind` (`criado`/`nota`/`prioridade`/`status`/`reaberto`/`transferido`/`assumido`), `text`, `author`, `created_at` | histórico mostrado no console | FR-054, US5.4 |
| `counters` | `kind`, `next_value` | numeração sequencial | FR-100 |
| `idempotency_keys` | `key` (PK), `ticket_number`, `operation`, `created_at` | "Confirmar" repetido devolve o mesmo resultado | FR-026, SC-002 |

Artigos da central de ajuda: módulo TypeScript estático (5–10 artigos com `title`, `body`, `category`, `conditions`, `keywords`); não precisa de tabela (FR-101).

- **Migration**: schema inicial de cada banco (`drizzle/app/0000_init.sql`, `drizzle/tickets/0000_init.sql`), só DDL, gerada por `drizzle-kit generate` a partir dos schemas e aplicada por `drizzle-orm/libsql/migrator` no `npm run setup`/`db:reset` e na subida do servidor (idempotente).
- **Rollback**: apagar os arquivos de banco e rodar `npm run db:reset` (ambiente local; sem dado de produção).
- **Backfill**: não se aplica; o seed cria tudo.

### Contratos

Todas as rotas são internas ao mesmo projeto (sem espelho em outro repo). JSON em UTF-8; erros no formato `{ error: { code, message } }`; sessão por cookie `nexo_session` (HttpOnly, SameSite=Lax). Validação de entrada com zod em `src/server/http/schemas.ts`.

| Rota / tipo | Método | Request | Response | Erros | Espelho em outro repo |
|-------------|--------|---------|----------|-------|-----------------------|
| `/api/auth/login` | POST | `{ email, password, remember }` | `200 { user }` + `Set-Cookie` | `400 invalid_input` (senha vazia); `401 email_not_found` "Não encontramos esse e-mail corporativo" | não |
| `/api/auth/logout` | POST | — | `204` + cookie expirado | — | não |
| `/api/me` | GET | — | `200 { user: { id, name, email, role, department, device, analystLevel, passwordChangedAt } }` | `401` | não |
| `/api/chat` | GET | — | `200 { conversations: [{ conversation, messages (com `parts` e `decision`), drafts }], currentId, counter: { used, limit }, state }` (conversas anteriores encerradas incluídas, mais antiga primeiro) | `401`; `403` se perfil ≠ funcionario | não |
| `/api/chat/messages` | POST | `{ text (1–2000), clientMessageId }` | `202 { messageId, conversationId }` | `409 limit_reached`; `409 duplicate` (mesmo `clientMessageId`, devolve o existente) | não |
| `/api/chat/messages/:id/retry` | POST | — | `202` | `404`; `409` se não está em `error` | não |
| `/api/chat/events` | GET (SSE) | `Last-Event-ID` opcional | eventos `message`, `text_delta`, `step`, `decision`, `draft`, `state`, `conversation` (nova conversa aberta), `error`, `heartbeat` (15 s) | `401` | não |
| `/api/drafts/:id/confirm` | POST | — | `200 { draft, ticket, message }` | `404`; `409 not_pending`; `503 tickets_unavailable` (após 3 tentativas; rascunho continua pendente) | não |
| `/api/drafts/:id/cancel` | POST | — | `200 { draft, message }` | `404`; `409 not_pending` | não |
| `/api/chat/continue` | POST | — | `200 { conversationId }` | `409` se limite não atingido | não |
| `/api/chat/transfer` | POST | — | `200 { conversation }` | `409` se não está `com_agent` | não |
| `/api/console/conversations` | GET | `?filter=todas\|para_voce\|com_agent\|minhas&q=` | `200 { items: [{ id, employee, preview, lastAt, label, relatedTicket, confidence, unread, waitingSince, late }], counts }` | `401`; `403` se perfil ≠ analista | não |
| `/api/console/conversations/:id` | GET | — | `200 { conversation, employee, messages, drafts, transferSummary, tickets: { ofConversation, others } }` (marca lida) | `404` | não |
| `/api/console/conversations/:id/take` | POST | — | `200 { conversation }` | `409 already_assigned { assignedTo }`; `409 closed` | não |
| `/api/console/conversations/:id/return` | POST | — | `200 { conversation }` | `409 not_allowed` | não |
| `/api/console/conversations/:id/close` | POST | — | `200 { conversation }` | `409 not_assigned_to_you` | não |
| `/api/console/conversations/:id/messages` | POST | `{ text, clientMessageId }` | `201 { message }` | `403 not_assigned_to_you` | não |
| `/api/console/events` | GET (SSE) | — | `conversation_updated { item }`, `heartbeat` | `401`/`403` | não |
| `/api/conversations/:id/events` | GET (SSE) | — | mesmos eventos de `/api/chat/events` para uma conversa específica (console; funcionário só na própria) | `403` | não |
| `TicketService` (TypeScript, `src/server/tickets/service.ts`) | — | `listByRequester(email, { includeResolvedSince? })`, `get(number, { requesterEmail? })`, `getWithEvents(number)`, `create(input, { idempotencyKey })`, `addNote(number, { text, author, newPriority? }, { idempotencyKey })`, `reopen(number, { text, author }, { idempotencyKey })`, `registerTransfer(number, { conversationId, reason, author })`, `setStatus(number, status, { text, author })` | tipos `Ticket`, `TicketEvent` (zod em `tickets/types.ts`) | `TicketServiceUnavailableError`, `TicketNotFoundError`, `IdempotencyConflictError` | não (interno) |

Eventos SSE: `id` incremental por conversa (para `Last-Event-ID`), `event` = tipo, `data` = JSON. O cliente, ao (re)conectar, chama o `GET` de snapshot e só então aplica eventos; eventos com `id` ≤ o do snapshot são ignorados.

### Lógica

| Regra | Onde vive (arquivo) | Entrada → saída | FR |
|-------|---------------------|-----------------|----|
| Autenticação por e-mail + qualquer senha; perfil | `src/server/auth/session.ts`, `src/app/api/auth/login/route.ts` | e-mail → usuário dos dados de exemplo ou erro "Não encontramos esse e-mail corporativo"; cookie HMAC `{userId, role, exp}` | FR-001, FR-002, FR-004, FR-005 |
| Redirecionamento por perfil | `src/proxy.ts` | cookie → `/chat` (funcionario) ou `/console` (analista); área errada redireciona | FR-004 |
| Turno do agent (orquestração) | `src/server/agent/run-turn.ts` | mensagem do funcionário → checa estado e limite → monta contexto → `agent.stream` → publica passos/texto → grava decisão → aplica pós-ações (transferência, encerramento, limite) | FR-011, FR-012, FR-028, FR-040, FR-070, FR-071 |
| Escolha de ação e registro de decisão | `src/server/agent/agent.ts` (instruções), `src/server/agent/tools/record-decision.ts` | contexto + ferramentas → `record_decision` obrigatório antes do texto final | FR-012, FR-030 |
| Prioridade e prazo (tabela do Anexo A) | `src/server/rules/priority.ts`, `src/server/rules/sla.ts`, `src/server/rules/business-hours.ts` | `{impact, urgency, kind}` → prioridade + regra; `(prioridade, desde)` → prazo em horas/dias úteis (Crítica corrida) e `vencido` | FR-017, FR-021, FR-103 |
| Duplicidade e reabertura | instruções do agent + `src/server/rules/reopen-window.ts` | chamados abertos/resolvidos do funcionário → `propose_draft` com `duplicate_check`; `resolved_at >= hoje−7d` → reabertura permitida (inclusivo) | FR-018 |
| Rascunho e confirmação | `src/server/drafts/service.ts`, `src/app/api/drafts/[id]/confirm|cancel/route.ts` | `propose_draft` substitui pendente; `confirm` executa no serviço de chamados com 3 tentativas, idempotente por `draft.id`; `cancel` descarta; crítico com `transfer_after_decision` transfere em seguida | FR-016, FR-024, FR-025, FR-026, FR-044, SC-002 |
| Transferência | `src/server/conversations/transfer.ts` | motivo + resumo → estado `aguardando_atendente`, evento de sistema, mensagem ao funcionário, evento no chamado em foco | FR-040, FR-041, FR-042, FR-032 |
| Limiar de confiança | `src/server/agent/run-turn.ts` + `env.ts` (`AGENT_CONFIDENCE_THRESHOLD=60`) | confiança registrada < limiar → transferência "agent sem segurança" | FR-032, FR-040 |
| Limite de 30 mensagens | `src/server/conversations/limit.ts` | contador por conversa; 30ª resposta anexa opções e bloqueia; "Continuar" encerra + resume + abre nova; "Falar com analista" transfere | FR-070, FR-071, FR-072 |
| Encerramento pelo agent | ferramenta `close_as_resolved` + pós-ação em `run-turn.ts` | só sem rascunho pendente e sem transferência agendada | FR-029 |
| Console: assumir/devolver/encerrar | `src/server/conversations/console-actions.ts` | transição atômica com condição de estado (`UPDATE … WHERE state IN (...) AND assigned_analyst_id IS NULL`); perdedor recebe 409 | FR-055, FR-057, FR-058, FR-060 |
| Privacidade nas ferramentas | `src/server/agent/tools/*.ts` + `src/server/tickets/service.ts` (interface exige `requesterEmail` em toda leitura de funcionário) | `employeeId` vem só de `requestContext`; chamado de outro → `not_found` | FR-003 |
| Acesso ao serviço de chamados com retry | `src/server/tickets/with-retry.ts` (decora qualquer `TicketService`) | chamada → 3 tentativas (500 ms, 1,5 s, 3 s) em `TicketServiceUnavailableError`; resultado com `attempts` para o passo | FR-026 |
| Simulação de indisponibilidade | `src/server/tickets/outage.ts` (usado por `LocalTicketService`) | por chamada, com probabilidade `TICKETS_OUTAGE_RATE` (0,1) abre janela de `TICKETS_OUTAGE_SECONDS` (4) em que toda operação lança `TicketServiceUnavailableError`; `0` desliga | FR-102 |
| Busca na central de ajuda | `src/server/help-center/search.ts` | consulta → pontuação por palavras-chave/título/corpo (normalização sem acento) → top 3 com condições | FR-013 |
| Resumo de transferência e resumo herdado | `src/server/agent/summarize.ts` | histórico → chamada curta ao modelo com saída estruturada | FR-041, FR-072 |
| Contabilização de custo | `src/server/agent/pricing.ts` | `usage` + modelo → `cost_usd` por decisão; `scripts/cost-report.ts` agrega | SC-009 |

### UI

Todas as telas são novas (não há design system no repo). "Componente" abaixo nomeia componentes React a criar em `src/components/`. Tokens (T7): Tailwind v4 com bloco `@theme` em `src/app/globals.css` declarando `--color-paper`, `--color-desk`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-rule`, `--color-cta`, `--color-primary`, `--color-primary-soft`, `--color-primary-text`, `--color-success(-soft/-text)`, `--color-warning(-soft/-text)`, `--color-danger(-soft/-text)`, `--color-violet(-soft/-text)`, `--font-ui`, `--font-display`, `--font-data`, `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px` (valores da seção Pesquisa a). Fontes via `next/font/google` (Schibsted Grotesk, Newsreader, IBM Plex Mono) ligadas às variáveis `--font-*`. Ícones: `lucide-react`. Textos exatos extraídos do protótipo.

| Bloco da tela | Componente | Tokens | Estados (vazio/carregando/erro) | Texto exato | FR |
|---------------|------------|--------|---------------------------------|-------------|----|
| Login › Showcase (esq., 800px) | `LoginShowcase` | `desk`, `ink`, `cta`, `font-display` para o título | estático | "Nexo Assist" · "Service desk de TI da Nexo" · "Seu problema de TI, resolvido em uma conversa." · "Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa." · prévia: "Meu notebook não conecta na VPN. Erro 809." / "consultou seus chamados · criou um chamado" / "Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis." / "INC-20517" / "Rede e VPN · Alta · em até 4 h" · stats "8 s primeira resposta, em média" / "72% resolvidos sem fila" / "6 analistas online agora" (estáticos) | US1 |
| Login › Formulário | `LoginForm` | `paper`, `rule`, `cta`, `radius-md` | carregando: botão "Entrar" desabilitado; erro: "Não encontramos esse e-mail corporativo" sob o campo | "Entrar" · "Use seu e-mail corporativo e a senha da rede Nexo." · "E-mail corporativo" (placeholder `ana.souza@nexo.com.br`) · "Senha" · "Esqueci minha senha" · "Manter conectado neste computador" · "Problema para entrar?" "Ligue no ramal 4000" · "© 2026 Nexo · Service desk de TI" · "Privacidade e uso de dados" | FR-001, FR-002 |
| Chat › Sidebar (232px) | `EmployeeSidebar` | `paper`, `rule`, `ink-3` | — | "Nexo Assist" · "Atendimento" · "Meu perfil" · avatar iniciais ("AS") · nome · e-mail · "Sair" | FR-005, US12 |
| Chat › Top bar | `ChatTopBar` | `rule`, `success` (ponto) | estado da conversa muda o rótulo | "Service desk de TI" · "Assistente online" / "Aguardando atendente" / "<Analista> está atendendo" / "Atendimento encerrado" | FR-043 |
| Chat › Lista de mensagens | `MessageList`, `EmployeeBubble` (raio `[12,12,4,12]`, `primary-soft`), `AgentBubble` (raio `[4,12,12,12]`, `paper`), `SystemEvent`, `AnalystBubble`, `DaySeparator` | `ink`, `ink-3`, `rule` | vazio: boas-vindas do agent; carregando: esqueleto; erro: `ErrorBubble` com "Tentar de novo"; separador "Conversa encerrada em <data> · <motivo>" | rótulos "Nexo Assist" "IA"; "Transferida para o service desk · hh:mm"; "Atendimento encerrado" | FR-010, FR-027, FR-029, FR-043, FR-053 |
| Chat › Passos do agent | `AgentSteps` (lista inline de pílulas com ícone de check/x e spinner no passo em execução) | `ink-3`, `success-text`, `danger-text` | carregando: passo com spinner; falha: ícone de erro | "consultou seus chamados" · "buscou na central de ajuda" · "classificou a prioridade" · "consultou o SLA" · "montou o rascunho" · "consultou o INC-20311" · "calculou o prazo" · "criou o chamado" · "atualizou o chamado" · "refez o rascunho" · "transferiu para analista" · "redirecionou" | FR-011 |
| Chat › Detalhe da decisão | `DecisionDetails` (expansível sob a resposta; só um aberto por vez) | `desk`, `rule`, `font-data` na seção Ferramentas | sem decisão (mensagem por template): seções reduzidas | "Entendi" · "Decidi" · "Confiança" (barra + %) · "Por quê" · "Regras aplicadas" · "Ferramentas" (nome, entrada, resultado, duração, ok/falha, tentativas) | FR-030, FR-031, FR-061 |
| Chat › Opções rápidas | `QuickOptions` (pílulas `radius-999`, `primary-text`) | | desabilitadas após uso ou com conversa fora de `com_agent` | ex.: "Só eu" "Minha equipe" "Toda a empresa" "Não sei" · "Falar com um analista" "Adicionar informação" "Não, obrigado" · "Continuar em nova conversa" "Falar com um analista" | FR-023, FR-021, FR-071 |
| Chat › Lista selecionável de chamados | `TicketPicker` | `paper`, `rule`, badges de status | | linha: número · título · status · data ("INC-20311" "Notebook lento após atualização" "Aguardando analista" "16 out") | FR-019, FR-023 |
| Chat › Card de chamado | `TicketCard` | badges `warning`/`danger`/`success` | marca "· prazo vencido" em `danger-text` | "Chamado" · título · descrição · "Categoria" · "Prioridade" · "Aberto em" · "Última atualização" · "há 5 dias" · "· prazo vencido" | FR-020 |
| Chat › Rascunho | `DraftCard` + `DraftActions` | `paper`, `primary` no "Confirmar", `rule` | pendente: botões ativos; confirmando: botões desabilitados + spinner; confirmado: mostra número e status; cancelado/substituído: card esmaecido com rótulo; erro do serviço: aviso "o sistema de chamados está instável, tente em instantes" e "Confirmar" reabilitado | "Novo chamado" / "Atualizar chamado" / "Reabrir chamado" · "Rascunho D-381" · "Aguardando confirmação" · título · descrição · "Categoria" · "Prioridade" "Alta" "· resposta até 13:43" · "Afetados" "Somente você" · "Confirmar" (atalho "⌘↵") · "Editar" · "Cancelar" | FR-016, FR-024, FR-026 |
| Chat › Composer | `Composer` | `paper`, `rule`, `cta` | habilitado em `aguardando_atendente` e `com_analista` (premissa do PRD: o agent só silencia); bloqueado no limite com aviso; >2.000 caracteres impede envio e informa; dica ao editar: "Diga o que quer mudar no rascunho" | placeholder "Escreva para o Nexo…" · "Enviar" · "N/30 mensagens nesta sessão" | FR-010, FR-024, FR-070, FR-071 |
| Perfil › Página | `ProfilePage` | `paper`, `rule` | aviso ao clicar "Redefinir senha" | "Seus dados de acesso ao service desk de TI." · "Nome" · "E-mail corporativo" · "Gerenciado pela TI" · "Senha" · "Alterada há 42 dias" · "Redefinir senha" · "Enviaremos um link de redefinição para <e-mail>." · aviso "Indisponível neste protótipo. Fale com a TI no ramal 4000." | FR-090 |
| Console › Rail (64px) | `ConsoleRail` | `ink` fundo, `paper` ícones | badge com contagem "Para você" | iniciais "RL" · ponto "online" | US8 |
| Console › Lista (380px) | `ConversationList`, `ConversationListItem`, `ConsoleFilters`, `ConsoleSearch` | `paper`, `rule`, `ink-3`, badges | vazio: "Nenhuma conversa aqui"; carregando: esqueleto de 5 itens | "Conversas" · "Disponível" (visual) · "Pesquisar conversa ou chamado" · "Todas" "Para você" "Com o agent" "Minhas" com contagens · item: iniciais, nome, hora ("10:05", "agora", "ontem"), prévia ("Nexo: …" quando do agent), rótulo ("Transferida · INC-20311", "Transferida · contato em 25 min", "Agent pediu ajuda · confiança 41%", "Agent atendendo", "Você está atendendo", "Resolvida pelo agent", "Encerrada · limite de mensagens", "Encerrada"), contador de não lidas | FR-050, FR-051, FR-052, FR-059 |
| Console › Cabeçalho da conversa | `ConversationHeader` | | | avatar, nome, linha "online · Financeiro · INC-20311", modo "Aguardando atendente" / botões "Devolver ao agent" "Encerrar atendimento" | FR-053, FR-057, FR-058 |
| Console › Resumo da transferência | `TransferSummary` (topo da conversa transferida) | `desk`, `warning-soft` | | "Motivo" · "Confiança" · "Problema" · "O que o agent já fez" · "Chamados" | FR-061 |
| Console › Histórico | reutiliza `MessageList` com `AnalystBubble` (nome + "Suporte N2"), `SystemEvent` | | separador "Hoje" | "Transferida para o service desk · 10:05" · "Rafael Lima assumiu · agent pausado · 10:12" · "Nexo Assist voltou" · "Atendimento encerrado" | FR-053, FR-061 |
| Console › Barra de assunção | `TakeoverBar` | `warning-soft`, `cta` | botões desabilitados durante a operação; 409: toast "Em atendimento por <nome>" | "<nome> espera um atendente" · "Agent pausado · até 12:05" · "Devolver ao agent" · "Assumir atendimento" · composer bloqueado "Assuma o atendimento para responder" | FR-055, FR-057 |
| Console › Composer do analista | `Composer` (variante analista) | | liberado só para o analista atribuído | placeholder "Escreva para <nome>…" | FR-056 |
| Console › Painel de chamados (340px) | `TicketPanel`, `TicketPanelItem` | `paper`, `rule` | vazio: "Nenhum chamado"; erro do serviço: "Serviço de chamados indisponível" + "Tentar de novo" | "Chamados da Ana" · "3 abertos · 2 encerrados" · "Desta conversa" · item: número, status, título, "Hardware · prioridade média", último evento ("Transferido para um analista", "Assumido por Rafael Lima") · "Outros chamados" · "INC-19877 · Resolvido em 02 set" | FR-054 |

### Observabilidade e rollout

- Logs: `src/server/logger.ts` (JSON por linha no stdout, níveis `info`/`warn`/`error`, campos `conversationId`, `messageId`, `tool`). Eventos: `turn_started`, `tool_call`, `tool_result` (duração, ok), `decision_recorded`, `decision_missing`, `transfer`, `conversation_closed`, `limit_reached`, `tickets_outage_started`, `tickets_retry`, `confirm_failed`, `sse_connected`/`sse_disconnected`, `startup_recovered_pending`.
- Métricas: derivadas do banco por `scripts/cost-report.ts` (tokens e custo por decisão e por conversa, duração p50/p95, taxa de fallback de decisão) e pelo `eval/report.md`.
- Flags (ambiente): `TICKETS_OUTAGE_RATE` (0,1; `0` desliga), `TICKETS_OUTAGE_SECONDS` (4), `AGENT_CONFIDENCE_THRESHOLD` (60), `AGENT_MESSAGE_LIMIT` (30), `GEMINI_MODEL`. Sem feature flag de código (T6/T3: não se aplica, projeto novo sem usuários).
- Ordem de subida: `startup.ts` aplica migrations dos dois bancos, semeia se vazio, marca mensagens `pending` como `error`, e só então o servidor aceita requisições. Sem deploy nesta iteração.

### Plano de commits (insumo para `/tasks`)

1. `chore: scaffold Next.js 16 + TypeScript estrito + Tailwind` · 2. `feat(db): schemas Drizzle, migrations e startup` · 3. `feat(tickets): módulo de chamados com banco próprio, idempotência e indisponibilidade simulada` · 4. `feat(rules): prioridade, SLA e horas úteis com testes` · 5. `feat(auth): login por perfil, cookie HMAC e proxy` · 6. `feat(seed): dados de exemplo com datas relativas e conversas prontas` · 7. `feat(agent): Agent Mastra, ferramentas e record_decision` · 8. `feat(chat): turno do agent, SSE e UI do chat` · 9. `feat(drafts): confirmar/cancelar/editar e fluxo crítico` · 10. `feat(console): lista, filtros, assumir/devolver/encerrar, painel de chamados` · 11. `feat(limit): limite de 30 mensagens e continuação com resumo` · 12. `test(eval): suíte de avaliação e relatório` · 13. `docs: README (como rodar, arquitetura, decisões, custo, trade-offs)`.

## Compatibilidade e rollout

| Item | Veredito | Evidência (caminho:linha) | Mitigação |
|------|----------|---------------------------|-----------|
| a. Cliente novo x API de produção | não se aplica | não há produção nem clientes instalados (`prd.md`, "Comportamento atual") | — |
| b. Cliente antigo x API nova | não se aplica | idem | — |
| c. Dado local persistido | compatível | bancos criados do zero pelo seed; schema versionado por migration | `npm run db:reset` recria; migrations futuras só aditivas |
| d. Jobs, filas, notificações, deep links, webhooks | não se aplica | nenhum job ou fila; SSE não persiste nada | reconexão do SSE recarrega o snapshot da conversa |
| e. Nativo / plataforma | não se aplica | web local; fontes carregadas por `next/font` | — |
| f. Parsing defensivo | compatível | respostas do serviço de chamados e do modelo validadas com zod; campo extra ignorado, ausente vira erro tratado | testes de parsing com payload incompleto |
| g. Migração / backfill de dado | não se aplica | sem dado prévio | — |
| h. Rollback | compatível | código: `git revert`; schema: apagar `data/*.db` + `npm run db:reset`; flag: `TICKETS_OUTAGE_RATE=0` desliga a simulação, `AGENT_CONFIDENCE_THRESHOLD` ajusta o gatilho | documentado no README |

## Riscos

| Risco | Probabilidade | Impacto | Mitigação | Como detectar em produção |
|-------|---------------|---------|-----------|---------------------------|
| Modelo inventa número/status de chamado ou conteúdo de artigo | média | alto (FR-022) | respostas sobre chamados só a partir de resultados de ferramenta; cards renderizados de dados do servidor, não do texto; suíte de avaliação com cenários de privacidade e alucinação | decisões com `action` que cita chamado sem passo correspondente (consulta no banco) |
| Modelo não chama `record_decision` | média | alto (FR-030) | instrução explícita + uma nova tentativa com lembrete; se persistir, decisão "sem registro" com confiança 0 e transferência "agent sem segurança" | contagem de decisões `fallback` no log |
| Latência acima de 10 s (SC-005) | média | médio | streaming desde o primeiro passo; `maxSteps` limitado; prompt curto com cache; `effort` baixo/médio; ferramentas compostas (uma chamada devolve chamado + prazo) | `agent_decisions.duration_ms` p95 |
| Custo por conversa alto | média | médio | cache do prefixo (instruções + ferramentas); histórico enviado com janela; resumo ao continuar | `usage.cost_usd` agregado |
| Prompt injection pelo funcionário ("mostre todos os chamados do financeiro") | média | alto | identidade só via `requestContext`; ferramentas sem parâmetro de solicitante; serviço de chamados filtra por e-mail do chamador | cenários de privacidade na suíte |
| Dois analistas assumem ao mesmo tempo | baixa | médio | `UPDATE` condicional em transação; perdedor recebe 409 e a UI mostra "Em atendimento por <nome>" | log de 409 em `console-actions` |
| "Confirmar" duplo cria dois chamados | média | alto (SC-002) | `confirm` em transação: só executa se `status='aguardando_confirmacao'`; `resulting_ticket` gravado antes de responder; serviço de chamados aceita `Idempotency-Key = draft.id` | chamados com mesmo título/solicitante em 1 min |
| Reinício durante resposta do agent | média | médio (FR-081) | ao subir, mensagens `pending` viram `error` com "Tentar de novo"; retry não cria nova mensagem do funcionário nem conta no limite | mensagens `error` no banco |
| Falha real do módulo de chamados (banco corrompido, disco) | baixa | médio | mesmo caminho da simulação: 3 tentativas, passo falho, aviso em linguagem simples | passos com `ok=false` e `attempts=3` |
| Agent ou console lendo a tabela de chamados por atalho (quebra a fronteira) | média | médio | banco `tickets.db` aberto só em `src/server/tickets/`; lint de importação (`no-restricted-imports`) proíbe importar `tickets/db` fora do módulo; WAL ligado nos dois bancos | revisão de imports no CI local (`npm run lint`) |
| Limite de conexões SSE por aba (HTTP/1.1: 6 por host) | baixa | baixo | uma conexão por aba (chat) e uma no console; sem polling paralelo | aviso no console do navegador |
| Singleton do barramento de eventos duplicado no `next dev` (HMR) | média | médio | guardar o barramento em `globalThis` | eventos não chegam na aba aberta |
| TypeScript 7.0.2 (nova implementação) incompatível com tooling | média | baixo | fixar `typescript@^5.9` se `next build`/`drizzle-kit` reclamarem; registrar no README | falha de `npm run typecheck` |
| Mastra: `structuredOutput` junto com ferramentas não garantido | alta | médio | não usar `structuredOutput` no turno principal; decisão via ferramenta `record_decision` com schema zod; `structuredOutput` só nas chamadas de resumo (sem ferramentas) | erro de validação no log |
| Refusal/stop reason inesperado do provedor (bloqueio por `safetySettings`, `content_filter`) | baixa | baixo | tratar `finishReason` diferente de `stop`/`tool_calls` como erro com "Tentar de novo"; `safetySettings` padrão | mensagens `error` com motivo |
| Limite de taxa do free tier do Gemini (429) durante uso ou na suíte de avaliação; cotas extraoficiais em 2026-10: Flash-Lite ~500 RPD, 3.8 Flash ~20 RPD | alta | médio | cliente com retry exponencial em 429 (3 tentativas); suíte roda cenários em série com pausa configurável (`EVAL_DELAY_MS`) e retoma de onde parou; limites atuais conferidos no AI Studio antes da entrega | erros 429 no log; cenários `skipped` no relatório |
| Dados enviados no free tier podem ser usados pelo Google para melhorar produtos | certa | baixo | só dados fictícios de exemplo; aviso no README; para uso real, chave paga | — |

## Estratégia de testes

Vitest 5 (T8), arquivos `*.test.ts` ao lado do código. Testes de integração usam bancos SQLite em arquivo temporário (`mkdtemp`) com as migrations reais. Nenhum teste chama o modelo, exceto a suíte de avaliação (`npm run eval`). Convenção: feature → testes dos cenários de aceite antes do código; mitigação de compatibilidade (leitura de `parts` com campo ausente) tem teste próprio em `messages/repo.test.ts`.

| FR | Tipo | Arquivo (existente / novo) | Comando | Observação |
|----|------|----------------------------|---------|------------|
| FR-017, FR-021, FR-103 | unitário | novo `src/server/rules/business-hours.test.ts`, `sla.test.ts`, `priority.test.ts` | `npx vitest run src/server/rules` | 18h→8h, fim de semana, Crítica corrida, "vencido" inclusivo, fuso, tabela de prioridade completa |
| FR-018 | unitário | novo `src/server/rules/reopen-window.test.ts` | `npx vitest run src/server/rules/reopen-window.test.ts` | exatamente 7 dias reabre; 8 não |
| FR-013 | unitário | novo `src/server/help-center/search.test.ts` | `npx vitest run src/server/help-center` | acentos, "809", condição de SO |
| FR-001, FR-002, FR-004, FR-005 | integração | novo `src/server/auth/session.test.ts` | `npx vitest run src/server/auth` | cookie válido/expirado/adulterado; perfil; e-mail desconhecido → `email_not_found` |
| FR-010 | unitário | novo `src/server/http/schemas.test.ts` | `npx vitest run src/server/http` | 2.000 caracteres; vazio |
| FR-003, FR-020 | integração | novo `src/server/agent/tools/tools.test.ts` (com `LocalTicketService` em banco temporário) | `npx vitest run src/server/agent/tools` | chamado de outro → `found: false`; sem parâmetro de solicitante |
| FR-011, FR-027, FR-030 | unitário | novo `src/server/agent/stream-consumer.test.ts` (iterável sintético de chunks) | `npx vitest run src/server/agent/stream-consumer.test.ts` | passos na ordem, coalescência de texto, decisão ausente → retry → fallback, erro → `status=error` sem recontar |
| FR-028 | unitário | novo `src/server/agent/context.test.ts` | `npx vitest run src/server/agent/context.test.ts` | rascunho pendente, chamado em foco e resumo herdado entram no bloco dinâmico |
| FR-029, FR-032, FR-040 | unitário | novo `src/server/agent/post-actions.test.ts` | `npx vitest run src/server/agent/post-actions.test.ts` | ordem das pós-ações; limiar; crítico com rascunho → `pending_transfer` |
| FR-016, FR-024, FR-025, FR-026, FR-044, SC-002 | integração | novo `src/server/drafts/service.test.ts` | `npx vitest run src/server/drafts` | confirmar duplo cria um só; falha 3× mantém pendente; cancelar crítico transfere; substituição marca anterior |
| FR-041, FR-042 | integração | novo `src/server/conversations/transfer.test.ts`, `service.test.ts` | `npx vitest run src/server/conversations` | resumo, evento, mensagem ao funcionário; mensagem em `aguardando_atendente` não chama agent |
| FR-055, FR-057, FR-058, FR-060 | integração | novo `src/server/conversations/console-actions.test.ts` | idem | assunção concorrente → 409; devolver nos dois estados; encerrar só pelo atribuído; assumir com o agent |
| FR-050, FR-051, FR-052, FR-103 | integração | novo `src/server/conversations/console-list.test.ts` | idem | rótulos, contagens dos filtros, busca por nome e número, não lidas, "atrasada" após 2 h úteis |
| FR-070, FR-071, FR-072 | integração | novo `src/server/conversations/limit.test.ts` | idem | 30ª mensagem; Confirmar não conta; analista não conta; continuar zera e herda resumo (resumo com stub) |
| FR-080, FR-081 | integração | novo `src/server/startup.test.ts` | `npx vitest run src/server/startup.test.ts` | migra, semeia se vazio, `pending` → `error` |
| FR-100, FR-102 | integração | novo `src/server/tickets/local-service.test.ts`, `with-retry.test.ts` | `npx vitest run src/server/tickets` | CRUD, idempotência, janela de indisponibilidade com taxa 1 e 0, retry conta tentativas |
| FR-101, FR-104 | integração | novo `src/server/seed/run.test.ts` | `npx vitest run src/server/seed` | INC-20311 vencido, INC-20150 ≤ 7 dias, 4–6 conversas com decisões completas, Ana sem conversa |
| compat. (f) | unitário | novo `src/server/messages/repo.test.ts` | `npx vitest run src/server/messages` | `parts` com campo ausente ou extra não quebra |
| FR-012–FR-015, FR-018, FR-019, FR-021, FR-022, FR-029, FR-032, FR-040, FR-044, SC-001, SC-003 | avaliação do agent (modelo real) | novo `eval/run.ts`, `eval/scenarios/*.ts` (24 cenários) | `npm run eval` | asserções determinísticas sobre `action`, tipo, categoria, prioridade, transferência, artigo; relatório em `eval/report.md`; meta ≥ 90% |
| FR-011, FR-023, FR-031, FR-043, FR-053, FR-054, FR-056, FR-059, FR-061, FR-090 | QA manual | roteiro abaixo | — | UI e tempo real |

**QA manual**

1. Caminho feliz: entrar como `ana.souza@nexo.com.br`; enviar "Meu notebook não conecta na VPN desde ontem. Erro 809."; escolher "Só eu"; conferir passos, rascunho (Rede e VPN, Alta, prazo), "Confirmar" → número INC; abrir detalhe da decisão; em outra aba entrar como analista, ver a conversa em "Com o agent", "Assumir atendimento", responder, "Devolver ao agent", ver retomada no chat da Ana.
2. Caso de borda: com `TICKETS_OUTAGE_RATE=1`, confirmar um rascunho → passo falho, aviso, rascunho continua pendente; voltar a `0.1`, confirmar de novo → um único chamado criado. Enviar 30 mensagens → opções de limite → "Continuar em nova conversa" → resumo herdado e contador 0/30.

**Verificação final do repo**

```bash
npm run lint        # eslint (next/core-web-vitals + no-restricted-imports para tickets/db)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # next build
npm run eval        # suíte de avaliação do agent (modelo real; grava eval/report.md)
```

## Rastreabilidade

| FR | Desenho | Teste |
|----|---------|-------|
| FR-001 | `auth/session.ts`, `api/auth/login/route.ts`, `LoginForm` | `auth/session.test.ts` |
| FR-002 | `api/auth/login/route.ts` (`401 email_not_found`), `LoginForm` erro inline | `auth/session.test.ts` |
| FR-003 | `tools/*` leem identidade só de `requestContext`; `TicketService.get(number, { requesterEmail })`; rotas `/api/console/*` exigem `analista` | `tools.test.ts`; eval `privacidade-numero-alheio`, `privacidade-financeiro` |
| FR-004 | `users.role`, `proxy.ts`, `auth/require.ts` (403) | `auth/session.test.ts`; QA 1 |
| FR-005 | `api/auth/logout/route.ts` | QA 1 |
| FR-010 | `Composer` (limite 2.000), `http/schemas.ts` | `http/schemas.test.ts` |
| FR-011 | `run-turn.ts` passo 5, `stream-consumer.ts`, eventos `step`/`text_delta`, `AgentSteps` | `stream-consumer.test.ts`; QA 1 |
| FR-012 | `record_decision.action`, `instructions.ts` | eval (todos) |
| FR-013 | `search_help_center` + `appliesToEmployee`, `help-center/search.ts` | `search.test.ts`; eval `duvida-horario`, `vpn-809-win11` |
| FR-014 | `redirect_out_of_scope` | eval `fora-escopo-ferias` |
| FR-015 | `instructions.ts` (≤ 2 perguntas), `offer_options` | eval `novo-inc-vpn`, `nao-sei-afetados` |
| FR-016 | `propose_draft`, `drafts/service.ts`, `DraftCard`, `api/drafts/[id]/confirm` | `drafts/service.test.ts`; eval `novo-inc-vpn`, `novo-req-monitor` |
| FR-017 | `rules/priority.ts`, `rules/sla.ts`, `rules/business-hours.ts`, `classify_priority` | `rules/*.test.ts` |
| FR-018 | `propose_draft.duplicateCheck`, `rules/reopen-window.ts`, `instructions.ts` | `reopen-window.test.ts`; eval `duplicado-vpn`, `reabertura-6d`, `reabertura-10d` |
| FR-019 | `instructions.ts`, `offer_ticket_selection`, `show_ticket_card` | eval `status-3-abertos`, `status-1-aberto`, `status-0` |
| FR-020 | `get_ticket`, `TicketCard` | `tools.test.ts`; QA 1 |
| FR-021 | `get_ticket.sla`, `offer_options` | eval `vencido-oferta` |
| FR-022 | `instructions.ts`; cards renderizados de dados do servidor | eval `alucinacao-numero-inexistente` |
| FR-023 | `QuickOptions`, `TicketPicker` → `POST /api/chat/messages` | QA 1 |
| FR-024 | `DraftActions` (Editar foca `Composer` com dica; Cancelar → `/cancel`), `propose_draft` substitui, prioridade recalculada no servidor | `drafts/service.test.ts`; eval `editar-categoria`, `pedir-critica-sem-motivo` |
| FR-025 | índice único parcial em `drafts`, status `substituido` | `drafts/service.test.ts` |
| FR-026 | `tickets/with-retry.ts`, `drafts/service.ts` (503 mantém pendente), passo `ok=false` | `with-retry.test.ts`, `drafts/service.test.ts` |
| FR-027 | `run-turn.ts` passo 9, `ErrorBubble`, `api/chat/messages/[id]/retry` | `stream-consumer.test.ts` |
| FR-028 | `agent/context.ts` (histórico, rascunho pendente, chamado em foco do banco) | `context.test.ts` |
| FR-029 | `close_as_resolved`, `post-actions.ts`, evento `resolvida` | `post-actions.test.ts`; eval `obrigado-encerra`, `obrigado-ambiguo` |
| FR-030 | `agent_decisions`, `record_decision`, `templates.ts` (decisões de template) | `stream-consumer.test.ts`; eval |
| FR-031 | `DecisionDetails` (um aberto por vez) | QA 1 |
| FR-032 | `post-actions.ts` (limiar `AGENT_CONFIDENCE_THRESHOLD`), `transfer_confidence` no console | `post-actions.test.ts`; eval `baixa-confianca` |
| FR-040 | `post-actions.ts`, `request_transfer`, `get_ticket` só oferece em vencido | `post-actions.test.ts`; eval `pedido-analista`, `critico-rede-andar`, `vencido-oferta` |
| FR-041 | `conversations/transfer.ts` (estado, resumo, evento, mensagem, `registerTransfer`) | `transfer.test.ts` |
| FR-042 | `run-turn.ts` passo 2 | `conversations/service.test.ts` |
| FR-043 | `ChatTopBar`, evento `state` | QA 1 |
| FR-044 | `drafts.transfer_after_decision`, `conversations.pending_transfer`, `drafts/service.ts` | `drafts/service.test.ts`; eval `critico-rede-andar` |
| FR-050 | `conversations/console-list.ts`, `ConversationListItem` | `console-list.test.ts`; QA 1 |
| FR-051 | `console-list.ts` (filtros e contagens), `ConsoleFilters` | `console-list.test.ts` |
| FR-052 | `console-list.ts` (`q`), `ConsoleSearch` | `console-list.test.ts` |
| FR-053 | `MessageList` (variantes), `DaySeparator` | QA 1 |
| FR-054 | `TicketPanel`, `GET /api/console/conversations/:id` (`tickets.ofConversation/others`) | QA 1 |
| FR-055 | `console-actions.take` (UPDATE condicional), `setStatus('em_atendimento')`, nota "Assumido por" | `console-actions.test.ts` |
| FR-056 | `POST /api/console/conversations/:id/messages`, SSE `message`, `AnalystBubble` | QA 1 |
| FR-057 | `console-actions.return`, `templates.ts` (retomada) | `console-actions.test.ts` |
| FR-058 | `console-actions.close`, evento `encerrada` | `console-actions.test.ts` |
| FR-059 | `GET /api/console/events`, `useConsole` | QA 1 |
| FR-060 | `console-actions.take` aceita `com_agent` | `console-actions.test.ts` |
| FR-061 | `TransferSummary`, `DecisionDetails` no console | QA 1 |
| FR-070 | `conversations/limit.ts`, `messages.counts_toward_limit`, `Composer` contador | `limit.test.ts` |
| FR-071 | `limit.ts` + `templates.ts` (`limit_options`), `limit_reached`, `LimitNotice` | `limit.test.ts` |
| FR-072 | `POST /api/chat/continue`, `summarize.ts`, `inherited_summary`, `previous_conversation_id` | `limit.test.ts`; QA 2 |
| FR-080 | SQLite + migrations (T5), gravação antes de responder | `startup.test.ts`; QA (reinício) |
| FR-081 | `startup.ts` (recupera `pending`), `retry` | `startup.test.ts` |
| FR-090 | `ProfilePage` | QA 1 |
| FR-100 | `tickets/service.ts`, `local-service.ts` | `local-service.test.ts` |
| FR-101 | `seed/users.ts`, `seed/tickets.ts`, `help-center/articles.ts` | `seed/run.test.ts` |
| FR-102 | `tickets/outage.ts` | `local-service.test.ts` |
| FR-103 | `rules/sla.ts` compartilhado por tools e `console-list.ts`/`TicketPanel` | `sla.test.ts`, `console-list.test.ts` |
| FR-104 | `seed/conversations.ts` (6 conversas com decisões) | `seed/run.test.ts` |
| FR-105 | `scripts/db-reset.ts`, README | QA 2 |

## Arquivos

Todos a criar (repositório vazio). Durante a implementação nada fora desta lista; arquivo novo necessário é sinal de spec incompleta e volta para cá antes de ser criado.

| Arquivo | Ação | O que muda |
|---------|------|------------|
| `.env.example` | criar | `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `SESSION_SECRET=`, `AGENT_CONFIDENCE_THRESHOLD=60`, `AGENT_MESSAGE_LIMIT=30`, `TICKETS_OUTAGE_RATE=0.1`, `TICKETS_OUTAGE_SECONDS=4`, `APP_DB_PATH=./data/app.db`, `TICKETS_DB_PATH=./data/tickets.db`, `EVAL_DELAY_MS=4000` |
| `.gitignore` | criar | `node_modules`, `.next`, `data/`, `.env`, `*.tsbuildinfo` |
| `package.json` | criar | scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `eval`, `db:reset`, `cost-report`, `format`; dependências decididas em T1–T8 |
| `next.config.ts` | criar | `serverExternalPackages: ['@mastra/core', '@libsql/client']` |
| `tsconfig.json` | criar | `strict`, `noUncheckedIndexedAccess`, paths `@/*` |
| `eslint.config.mjs` | criar | `next/core-web-vitals` + `no-restricted-imports` proibindo `tickets/db` fora de `src/server/tickets` |
| `.prettierrc` | criar | formatação |
| `vitest.config.ts` | criar | ambiente node, `include: src/**/*.test.ts`, alias `@/` |
| `drizzle.config.app.ts` | criar | schema `src/server/db/schema.ts` → `drizzle/app` |
| `drizzle.config.tickets.ts` | criar | schema `src/server/tickets/schema.ts` → `drizzle/tickets` |
| `drizzle/app/0000_init.sql` | criar | migration gerada do banco `app` |
| `drizzle/tickets/0000_init.sql` | criar | migration gerada do banco `tickets` |
| `README.md` | criar | como rodar (3 comandos), contas de exemplo, arquitetura, como o agent decide, qualidade (suíte), modelo e custo, trade-offs, o que faria com mais tempo |
| `scripts/db-reset.ts` | criar | apaga `data/*.db`, migra e semeia (FR-105) |
| `scripts/cost-report.ts` | criar | agrega `agent_decisions.usage` por conversa (SC-009) |
| `eval/run.ts` | criar | executor da suíte; bancos temporários; relatório |
| `eval/types.ts` | criar | tipos de cenário e asserção |
| `eval/report.md` | criar | relatório gerado (commitado na entrega) |
| `eval/scenarios/duvida-horario.ts` | criar | cenário `duvida-horario` |
| `eval/scenarios/vpn-809-win11.ts` | criar | cenário `vpn-809-win11` |
| `eval/scenarios/fora-escopo-ferias.ts` | criar | cenário `fora-escopo-ferias` |
| `eval/scenarios/novo-inc-vpn.ts` | criar | cenário `novo-inc-vpn` |
| `eval/scenarios/novo-req-monitor.ts` | criar | cenário `novo-req-monitor` |
| `eval/scenarios/duplicado-vpn.ts` | criar | cenário `duplicado-vpn` |
| `eval/scenarios/reabertura-6d.ts` | criar | cenário `reabertura-6d` |
| `eval/scenarios/reabertura-10d.ts` | criar | cenário `reabertura-10d` |
| `eval/scenarios/status-3-abertos.ts` | criar | cenário `status-3-abertos` |
| `eval/scenarios/status-1-aberto.ts` | criar | cenário `status-1-aberto` |
| `eval/scenarios/status-0.ts` | criar | cenário `status-0` |
| `eval/scenarios/vencido-oferta.ts` | criar | cenário `vencido-oferta` |
| `eval/scenarios/critico-rede-andar.ts` | criar | cenário `critico-rede-andar` |
| `eval/scenarios/pedido-analista.ts` | criar | cenário `pedido-analista` |
| `eval/scenarios/baixa-confianca.ts` | criar | cenário `baixa-confianca` |
| `eval/scenarios/privacidade-numero-alheio.ts` | criar | cenário `privacidade-numero-alheio` |
| `eval/scenarios/privacidade-financeiro.ts` | criar | cenário `privacidade-financeiro` |
| `eval/scenarios/alucinacao-numero-inexistente.ts` | criar | cenário `alucinacao-numero-inexistente` |
| `eval/scenarios/editar-categoria.ts` | criar | cenário `editar-categoria` |
| `eval/scenarios/pedir-critica-sem-motivo.ts` | criar | cenário `pedir-critica-sem-motivo` |
| `eval/scenarios/obrigado-encerra.ts` | criar | cenário `obrigado-encerra` |
| `eval/scenarios/obrigado-ambiguo.ts` | criar | cenário `obrigado-ambiguo` |
| `eval/scenarios/nao-sei-afetados.ts` | criar | cenário `nao-sei-afetados` |
| `eval/scenarios/sem-artigo-oferece.ts` | criar | cenário `sem-artigo-oferece` |
| `src/env.ts` | criar | leitura e validação zod das variáveis; expõe `env` |
| `src/proxy.ts` | criar | redireciona por perfil: sem sessão → `/login`; funcionario em `/console` → `/chat`; analista em `/chat`/`/perfil` → `/console` |
| `src/app/layout.tsx` | criar | fontes (`next/font/google`), `globals.css`, metadados |
| `src/app/globals.css` | criar | `@import 'tailwindcss'` + `@theme` com os tokens do `.pen` |
| `src/app/page.tsx` | criar | redireciona para `/chat` ou `/console` conforme sessão |
| `src/app/login/page.tsx` | criar | tela 1: `LoginShowcase` + `LoginForm` |
| `src/app/chat/page.tsx` | criar | telas 2/3: carrega snapshot no servidor e monta `ChatScreen` |
| `src/app/perfil/page.tsx` | criar | tela 6: `ProfilePage` |
| `src/app/console/page.tsx` | criar | telas 4/5: `ConsoleScreen` (lista + conversa `?c=` + painel) |
| `src/app/api/auth/login/route.ts` | criar | POST login |
| `src/app/api/auth/logout/route.ts` | criar | POST logout |
| `src/app/api/me/route.ts` | criar | GET usuário da sessão |
| `src/app/api/chat/route.ts` | criar | GET snapshot do funcionário |
| `src/app/api/chat/messages/route.ts` | criar | POST mensagem → `runTurn` em segundo plano |
| `src/app/api/chat/messages/[id]/retry/route.ts` | criar | POST reexecuta turno |
| `src/app/api/chat/events/route.ts` | criar | GET SSE do funcionário |
| `src/app/api/chat/continue/route.ts` | criar | POST continuar em nova conversa |
| `src/app/api/chat/transfer/route.ts` | criar | POST falar com analista no limite |
| `src/app/api/drafts/[id]/confirm/route.ts` | criar | POST confirmar rascunho |
| `src/app/api/drafts/[id]/cancel/route.ts` | criar | POST cancelar rascunho |
| `src/app/api/console/conversations/route.ts` | criar | GET lista com filtros e contagens |
| `src/app/api/console/conversations/[id]/route.ts` | criar | GET snapshot da conversa + chamados; marca lida |
| `src/app/api/console/conversations/[id]/take/route.ts` | criar | POST assumir |
| `src/app/api/console/conversations/[id]/return/route.ts` | criar | POST devolver ao agent |
| `src/app/api/console/conversations/[id]/close/route.ts` | criar | POST encerrar |
| `src/app/api/console/conversations/[id]/messages/route.ts` | criar | POST mensagem do analista |
| `src/app/api/console/events/route.ts` | criar | GET SSE da lista |
| `src/app/api/conversations/[id]/events/route.ts` | criar | GET SSE de uma conversa (console) |
| `src/components/ui/Button.tsx` | criar | botão primário/secundário/fantasma com estado de carregamento |
| `src/components/ui/Badge.tsx` | criar | pílula de status/prioridade |
| `src/components/ui/Avatar.tsx` | criar | iniciais |
| `src/components/ui/Skeleton.tsx` | criar | esqueleto de carregamento |
| `src/components/ui/Spinner.tsx` | criar | indicador em passos e botões |
| `src/components/ui/Toast.tsx` | criar | avisos (409, indisponível no protótipo) |
| `src/components/login/LoginShowcase.tsx` | criar | painel esquerdo estático |
| `src/components/login/LoginForm.tsx` | criar | formulário, erro inline, links visuais |
| `src/components/chat/ChatScreen.tsx` | criar | container: estado, `useChat`, layout sidebar + main |
| `src/components/chat/EmployeeSidebar.tsx` | criar | navegação e usuário |
| `src/components/chat/ChatTopBar.tsx` | criar | título e estado da conversa |
| `src/components/chat/MessageList.tsx` | criar | renderiza mensagens, eventos e separadores (usado no console) |
| `src/components/chat/EmployeeBubble.tsx` | criar | bolha do funcionário |
| `src/components/chat/AgentBubble.tsx` | criar | bolha do agent com passos, partes ricas e detalhe |
| `src/components/chat/AnalystBubble.tsx` | criar | bolha do analista (nome e nível) |
| `src/components/chat/SystemEvent.tsx` | criar | evento de sistema |
| `src/components/chat/DaySeparator.tsx` | criar | separador de dia e de conversa encerrada |
| `src/components/chat/AgentSteps.tsx` | criar | pílulas de passos com estado |
| `src/components/chat/DecisionDetails.tsx` | criar | bloco expansível (Entendi/Decidi/Confiança/Por quê/Regras/Ferramentas) |
| `src/components/chat/QuickOptions.tsx` | criar | opções rápidas |
| `src/components/chat/TicketPicker.tsx` | criar | lista selecionável de chamados |
| `src/components/chat/TicketCard.tsx` | criar | card de chamado com prazo |
| `src/components/chat/DraftCard.tsx` | criar | card de rascunho |
| `src/components/chat/DraftActions.tsx` | criar | Confirmar / Editar / Cancelar |
| `src/components/chat/Composer.tsx` | criar | campo, contador N/30, bloqueio, dica de edição |
| `src/components/chat/ErrorBubble.tsx` | criar | erro com "Tentar de novo" |
| `src/components/chat/LimitNotice.tsx` | criar | opções no limite |
| `src/components/chat/ProfilePage.tsx` | criar | meu perfil somente leitura |
| `src/components/console/ConsoleScreen.tsx` | criar | container do console, `useConsole` |
| `src/components/console/ConsoleRail.tsx` | criar | trilho com badge |
| `src/components/console/ConversationList.tsx` | criar | lista com esqueleto e vazio |
| `src/components/console/ConversationListItem.tsx` | criar | item com rótulo e não lidas |
| `src/components/console/ConsoleFilters.tsx` | criar | Todas / Para você / Com o agent / Minhas |
| `src/components/console/ConsoleSearch.tsx` | criar | busca |
| `src/components/console/ConversationHeader.tsx` | criar | cabeçalho com ações |
| `src/components/console/TransferSummary.tsx` | criar | resumo da transferência |
| `src/components/console/TakeoverBar.tsx` | criar | barra de assunção e composer bloqueado |
| `src/components/console/TicketPanel.tsx` | criar | painel de chamados |
| `src/components/console/TicketPanelItem.tsx` | criar | item expansível |
| `src/hooks/useEventSource.ts` | criar | SSE com reconexão e `Last-Event-ID` |
| `src/hooks/useChat.ts` | criar | snapshot + eventos → estado do chat; envio, retry, confirmar/cancelar |
| `src/hooks/useConsole.ts` | criar | lista + conversa aberta + ações |
| `src/lib/api.ts` | criar | cliente `fetch` tipado |
| `src/lib/format.ts` | criar | datas/horas pt-BR em America/Sao_Paulo ("há 5 dias", "16 out") |
| `src/lib/labels.ts` | criar | rótulos de estado compartilhados (chat e console) |
| `src/server/db/client.ts` | criar | `@libsql/client` + Drizzle para `app.db`, WAL |
| `src/server/db/schema.ts` | criar | tabelas do banco `app` |
| `src/server/db/migrate.ts` | criar | aplica migrations dos dois bancos |
| `src/server/auth/session.ts` | criar | assina/valida cookie HMAC |
| `src/server/auth/require.ts` | criar | `requireEmployee`/`requireAnalyst` para rotas |
| `src/server/http/schemas.ts` | criar | schemas zod de entrada das rotas |
| `src/server/http/respond.ts` | criar | `ok`/`fail` com formato de erro |
| `src/server/http/sse.ts` | criar | `ReadableStream` SSE com heartbeat e assinatura no barramento |
| `src/server/events/bus.ts` | criar | `EventEmitter` por conversa e canal console, em `globalThis` |
| `src/server/logger.ts` | criar | log JSON |
| `src/server/startup.ts` | criar | migra, semeia se vazio, recupera `pending` |
| `src/server/agent/agent.ts` | criar | `new Agent(...)` com modelo e ferramentas |
| `src/server/agent/instructions.ts` | criar | bloco estático + função do bloco dinâmico |
| `src/server/agent/context.ts` | criar | monta histórico e `RequestContext` |
| `src/server/agent/run-turn.ts` | criar | orquestrador do turno |
| `src/server/agent/stream-consumer.ts` | criar | consome `fullStream` → passos, texto, decisão |
| `src/server/agent/post-actions.ts` | criar | encerrar, transferir, limite |
| `src/server/agent/labels.ts` | criar | ferramenta → rótulo de passo |
| `src/server/agent/pricing.ts` | criar | tabela de preços por modelo → `cost_usd` |
| `src/server/agent/summarize.ts` | criar | resumos de transferência e de continuação (`structuredOutput`) |
| `src/server/agent/templates.ts` | criar | mensagens por template e suas decisões |
| `src/server/agent/tools/index.ts` | criar | registro das ferramentas |
| `src/server/agent/tools/context.ts` | criar | chaves do `RequestContext` e cache por turno |
| `src/server/agent/tools/list-my-tickets.ts` | criar | ferramenta |
| `src/server/agent/tools/get-ticket.ts` | criar | ferramenta |
| `src/server/agent/tools/search-help-center.ts` | criar | ferramenta |
| `src/server/agent/tools/classify-priority.ts` | criar | ferramenta |
| `src/server/agent/tools/propose-draft.ts` | criar | ferramenta |
| `src/server/agent/tools/offer-options.ts` | criar | ferramenta |
| `src/server/agent/tools/offer-ticket-selection.ts` | criar | ferramenta |
| `src/server/agent/tools/show-ticket-card.ts` | criar | ferramenta |
| `src/server/agent/tools/request-transfer.ts` | criar | ferramenta |
| `src/server/agent/tools/redirect-out-of-scope.ts` | criar | ferramenta |
| `src/server/agent/tools/close-as-resolved.ts` | criar | ferramenta |
| `src/server/agent/tools/record-decision.ts` | criar | ferramenta |
| `src/server/conversations/repo.ts` | criar | consultas Drizzle de conversas |
| `src/server/conversations/service.ts` | criar | abrir/obter conversa atual, encerrar como resolvida |
| `src/server/conversations/transfer.ts` | criar | transferência |
| `src/server/conversations/limit.ts` | criar | contador, mensagem de limite, continuar |
| `src/server/conversations/console-actions.ts` | criar | assumir/devolver/encerrar/mensagem do analista |
| `src/server/conversations/console-list.ts` | criar | lista, filtros, busca, contagens, não lidas |
| `src/server/conversations/snapshot.ts` | criar | snapshots do chat e do console |
| `src/server/messages/repo.ts` | criar | mensagens e partes ricas (leitura tolerante) |
| `src/server/decisions/repo.ts` | criar | registros de decisão |
| `src/server/drafts/repo.ts` | criar | rascunhos |
| `src/server/drafts/service.ts` | criar | propor, confirmar, cancelar, expirar |
| `src/server/rules/priority.ts` | criar | tabela do Anexo A |
| `src/server/rules/sla.ts` | criar | prazo e vencido |
| `src/server/rules/business-hours.ts` | criar | horas/dias úteis com `Intl` |
| `src/server/rules/reopen-window.ts` | criar | janela de 7 dias |
| `src/server/rules/catalog.ts` | criar | tipos, categorias, status, prioridades e rótulos |
| `src/server/help-center/articles.ts` | criar | 5–10 artigos (inclui os dois do Anexo B) |
| `src/server/help-center/search.ts` | criar | busca por termos |
| `src/server/tickets/service.ts` | criar | interface `TicketService` |
| `src/server/tickets/types.ts` | criar | `Ticket`, `TicketEvent` (zod) |
| `src/server/tickets/errors.ts` | criar | erros do serviço |
| `src/server/tickets/local-service.ts` | criar | `LocalTicketService` |
| `src/server/tickets/schema.ts` | criar | tabelas do banco `tickets` (inclui `idempotency_keys`) |
| `src/server/tickets/db.ts` | criar | cliente do `tickets.db` (import restrito) |
| `src/server/tickets/outage.ts` | criar | janela de indisponibilidade |
| `src/server/tickets/with-retry.ts` | criar | decorador de retry |
| `src/server/tickets/index.ts` | criar | fábrica: `LocalTicketService` + `withRetry` |
| `src/server/seed/users.ts` | criar | 7 funcionários + 2 analistas |
| `src/server/seed/tickets.ts` | criar | chamados com datas relativas |
| `src/server/seed/conversations.ts` | criar | 6 conversas prontas com decisões |
| `src/server/seed/run.ts` | criar | carga idempotente |
| `src/server/rules/business-hours.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/rules/sla.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/rules/priority.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/rules/reopen-window.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/help-center/search.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/auth/session.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/http/schemas.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/agent/tools/tools.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/agent/stream-consumer.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/agent/context.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/agent/post-actions.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/drafts/service.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/conversations/transfer.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/conversations/service.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/conversations/console-actions.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/conversations/console-list.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/conversations/limit.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/startup.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/tickets/local-service.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/tickets/with-retry.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/seed/run.test.ts` | criar | teste (ver Estratégia de testes) |
| `src/server/messages/repo.test.ts` | criar | teste (ver Estratégia de testes) |

## Fora de escopo

- Deploy, proteção de chave em plataforma e limite por IP.
- Observabilidade com backend externo (OpenTelemetry, Langfuse); só logs locais e dados no banco.
- Painel administrativo, i18n, mobile, anexos, notificações (já fora no PRD).
- Refatoração de nada: não há código prévio.

## Decisões

- T1 — Mastra (Agent + tools) ou LangGraph.js (grafo explícito)? → Mastra `Agent` com ferramentas zod e `record_decision` obrigatória; o servidor envolve o turno (checa estado e limite antes, aplica gatilhos de confiança/crítico depois) — preferência declarada do PDF; transparência vem do registro de decisão persistido e do rastro de `tool-call`/`tool-result`, não do orquestrador; menos código.
- T2 — Qual provedor e modelo por padrão? → Google Gemini 3.5 Flash-Lite (`google/gemini-3.5-flash-lite`) via roteador do Mastra, com `GEMINI_API_KEY` e `GEMINI_MODEL` iguais ao projeto `sendEmailJobs` do usuário (`backend/.env.example` e `backend/src/config/env.validation.ts`, que já usa esse modelo como padrão); `thinkingLevel: "low"` nos turnos de chat — decisão do usuário: free tier cobre desenvolvimento, suíte de avaliação e execução pelo avaliador sem custo, e a chave já existe; cota diária extraoficial do Flash-Lite (500 RPD) comporta a suíte, enquanto a do 3.8 Flash (20 RPD, relato de fórum) não; 1M de contexto e function calling atendem o desenho. Recomendação original (Claude Opus 5.5) não adotada; fica como alternativa na tabela de abordagens. O `.env` do outro projeto não foi lido (regra da skill): só o `.env.example` e o código.
- T3 — Um app Next.js único ou SPA + API separada? → Next.js 16 App Router único na raiz do repositório: páginas, route handlers, agent e serviços no mesmo processo; serviço de chamados em processo próprio (T4) — separação de responsabilidades por módulos e contratos; só vira processo o que tem fronteira real de falha; menos comandos para o avaliador.
- T4 — Serviço de chamados em processo HTTP separado ou módulo in-process? → Módulo in-process `src/server/tickets/` atrás da interface `TicketService` (`LocalTicketService` com banco SQLite próprio `data/tickets.db`, indisponibilidade simulada por `TicketServiceUnavailableError` em janela de alguns segundos, decorador `withRetry` no chamador) — escolha do usuário: um processo só, sem dependência extra; a separação fica por fronteira de módulo, de banco e de contrato tipado, e a interface permite extrair para processo HTTP depois sem tocar no agent nem no console. Recomendação original (processo HTTP) não adotada.
- T5 — SQLite via Drizzle, `node:sqlite` nativo ou Postgres em Docker? → Drizzle ORM + `@libsql/client`, dois arquivos SQLite (`data/app.db`, `data/tickets.db`), migrations geradas pelo `drizzle-kit` — tipos derivados do schema e migrations versionadas sem exigir serviço externo do avaliador; Drizzle permite trocar para Postgres depois com schema quase igual.
- T6 — SSE, WebSocket ou polling? → SSE: `GET /api/conversations/:id/events` (chat e console) e `GET /api/console/events` (lista), comandos por `POST`, barramento `EventEmitter` em `globalThis`, heartbeat a cada 15 s, snapshot recarregado na reconexão — transporte mais simples que atende a latência; fluxo é servidor→cliente com comandos esparsos; sem dependência e sem servidor customizado.
- T7 — Tailwind + componentes próprios, CSS Modules ou shadcn/ui? → Tailwind v4 com tokens do `.pen` em `@theme`, ~25 componentes próprios, `lucide-react`, fontes por `next/font/google` — protótipo fechado e poucos componentes: biblioteca de UI viraria custo de sobrescrita; tokens compartilhados garantem fidelidade.
- T8 — Quais dependências de apoio e testes? → Mínimo: `vitest`, `tsx`, `prettier` (+ ESLint do scaffold); comandos `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run eval`; UI por QA manual — teste onde o custo do erro é alto e o teste é barato (regras, módulo de chamados, decisão do agent); protótipo fechado se verifica olhando.
- T9 (autor, diferença trivial) — Horas úteis com biblioteca ou implementação própria? → Própria em `rules/business-hours.ts` com `Intl.DateTimeFormat` (America/Sao_Paulo), ~60 linhas e testes — evita dependência de datas só para um cálculo fechado.
- T10 (autor) — Sessão com biblioteca ou cookie assinado próprio? → Cookie `nexo_session` com payload base64url + HMAC-SHA256 (`node:crypto`, `SESSION_SECRET`), `exp` de 30 dias com "Manter conectado" ou cookie de sessão sem ele — autenticação é simulada; 40 linhas bastam e não há senha real para proteger.
- T11 (autor) — Busca na central de ajuda por embeddings ou palavras-chave? → Pontuação determinística por termos normalizados (título ×3, palavras-chave ×2, corpo ×1) sobre 5–10 artigos, top 3 — tamanho não justifica embeddings; determinismo ajuda a suíte.
- T12 (autor) — Decisão estruturada por `structuredOutput` ou por ferramenta? → Ferramenta `record_decision` com schema zod, obrigatória uma vez por turno — Mastra não garante `structuredOutput` junto com ferramentas; a ferramenta chega no `fullStream` como qualquer passo e fica no mesmo registro.
- T13 (autor) — Monorepo com workspaces ou projeto único? → Projeto único na raiz (sem `apps/`/`packages/`) — T3 e T4 deixaram um processo só; workspaces só adicionariam configuração. Memória/storage do Mastra não são usados: a persistência do domínio é própria (T5).

## Pendências

Nenhuma.
