# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário conversa em linguagem natural; o Nexo Assist consulta os chamados dele, busca na central de ajuda, monta rascunhos de chamado que só são gravados depois de "Confirmar", transfere para um analista quando precisa e mostra, em cada resposta, o que fez e por quê. O analista tem um console para ver as conversas, assumir, responder, devolver ao agent e encerrar.

## Como este projeto foi construído: Spec Driven Design com IA

Trabalhei com IA usando **Spec Driven Design**: nenhuma linha de código foi escrita antes de existir uma especificação aprovada, e cada etapa só começou depois que a anterior estava fechada. Meu papel foi o de **arquiteto**: a IA pesquisava, propunha alternativas e escrevia; eu decidia, cortava escopo e corrigia quando ela errava. Os três documentos estão em [`docs/`](docs/) e foram versionados junto com o código.

1. **PRD** ([`docs/prd.md`](docs/prd.md)). Partiu do PDF do desafio e do protótipo no Pencil (6 telas). A IA cruzou as duas fontes e listou 20 incongruências entre elas (por exemplo: o Anexo A diz que chamado vencido *transfere*, o protótipo mostra o agent *oferecendo* um analista). Cada incongruência virou uma pergunta, e eu tomei as decisões D1 a D9: o analista entra pelo mesmo login; "sessão" no limite de 30 mensagens é a conversa; o detalhe da decisão abre logo abaixo da resposta; vencido é oferecido, e pedido, crítico e baixa confiança transferem sozinhos; caso crítico segue rascunho → confirmar → criar → transferir; editar o rascunho é pela conversa; deploy fica fora desta iteração. O resultado são 12 histórias, 57 requisitos funcionais testáveis e critérios de sucesso mensuráveis.
2. **Tech Spec** ([`docs/tech-spec.md`](docs/tech-spec.md)). A IA pesquisou o ambiente, as versões das bibliotecas e a documentação do Mastra e do Next.js 16, e apresentou alternativas com prós e contras para cada escolha de arquitetura. Decidi T1 a T8, e em dois pontos não segui a recomendação dela: escolhi o **Gemini 3.5 Flash-Lite**, que tem free tier e para o qual eu já tinha chave, em vez do modelo pago sugerido (T2); e escolhi o **serviço de chamados como módulo com banco próprio** atrás de um contrato, em vez de um processo HTTP separado (T4), para o avaliador rodar tudo com um comando. A spec liga cada requisito ao arquivo que o implementa e ao teste que o prova.
3. **Tasks** ([`docs/tasks.md`](docs/tasks.md)). As tarefas foram quebradas por história, com testes antes do código e um plano de commits por fase. A análise cruzada entre PRD e spec encontrou 6 furos antes da implementação (um comando citado no README que não existia, uma dica no prompt sem origem no contrato da API, pós-ações que não reliam o estado da conversa, limite checado em um ponto só…), e cada um ganhou uma resolução registrada.
4. **Implementação e verificação**. A IA executou as tarefas na ordem. Pedi ênfase em suítes de testes; o resultado está na seção [Qualidade](#qualidade). No teste manual no navegador, com o modelo real, apareceu um erro que os testes não pegavam: quando a API do Gemini demorava, o tempo limite abortava a resposta, o turno era tratado como "decisão não registrada" e a conversa ia para um analista com confiança 0. Fizemos a correção, com testes de regressão: aborto vira erro com "Tentar de novo", o tempo limite é configurável e o turno gasta uma ida a menos ao modelo.

O que a especificação garantiu na prática: as regras de negócio (prioridade, prazo, confirmação antes de gravar, privacidade, limite) ficaram em código testável e não só no prompt, e qualquer mudança de comportamento tem um requisito, uma decisão ou um achado registrado que a justifica.

## Como rodar

Requisitos: Node 22 ou mais novo (testado no 24) e uma chave gratuita do [Google AI Studio](https://aistudio.google.com/apikey).

```bash
cp .env.example .env      # cole sua chave em GEMINI_API_KEY
npm install
npm run dev               # http://localhost:3000
```

Na primeira requisição o servidor cria os bancos em `data/`, aplica as migrations e carrega os dados de exemplo. Para voltar ao estado inicial: `npm run db:reset`.

### Contas de exemplo

Qualquer senha não vazia funciona (a autenticação é simulada).

| Perfil | E-mail | Observação |
|--------|--------|------------|
| Funcionária (conta principal) | `ana.souza@nexo.com.br` | Financeiro, notebook Windows 11. Começa sem conversa; tem INC-20311 vencido, INC-20298 em andamento, REQ-10442 aprovado e INC-20150 resolvido há 4 dias |
| Analista N2 | `rafael.lima@nexo.com.br` | |
| Analista N1 | `juliana.costa@nexo.com.br` | Útil para testar dois analistas assumindo ao mesmo tempo |
| Funcionários com conversas prontas | `carla.mendes@`, `bruno.tavares@`, `diego.ramos@`, `elisa.prado@`, `fabio.nunes@`, `gabriela.rocha@nexo.com.br` | Estados variados no console: aguardando por pedido, aguardando por baixa confiança (41%), com o agent, resolvida, encerrada pelo analista |

### Roteiro rápido

1. Entre como Ana e escreva "Meu notebook não conecta na VPN desde ontem. Erro 809.". Responda "Só eu. Tenho reunião com cliente às 14h.", confira o rascunho (Rede e VPN, Alta, horário da resposta) e clique em **Confirmar**. Clique nos passos acima de qualquer resposta para abrir o detalhe da decisão.
2. Pergunte "qual o status do meu chamado?", escolha o INC-20311 (vencido) e peça um analista.
3. Em outra janela anônima, entre como Rafael: a conversa da Ana aparece em **Para você** com o resumo da transferência. Assuma, responda, devolva ao agent ou encerre; o chat da Ana muda sozinho.
4. Casos de borda: `TICKETS_OUTAGE_RATE=1` no `.env` faz o serviço de chamados falhar (o "Confirmar" avisa e o rascunho continua pendente); `AGENT_MESSAGE_LIMIT=3` mostra o limite de mensagens e o "Continuar em nova conversa".

## Arquitetura

Um único projeto Next.js 16 (App Router) com interface, API e agent no mesmo processo, e dois bancos SQLite.

```
navegador ── páginas /login /chat /perfil /console (React + Tailwind, tokens do protótipo)
   │  fetch (comandos)          ▲ SSE (passos, texto progressivo, estados)
   ▼                            │
API  src/app/api/**  ── sessão por cookie HMAC, validação zod, erros { error: { code, message } }
   │
domínio  src/server/conversations · drafts · rules · help-center · auth   (regras de negócio, testáveis sem HTTP)
   │
agent  src/server/agent  ── Mastra Agent + 12 ferramentas zod, record_decision obrigatória,
   │                         turno orquestrado pelo servidor (estado, limite, pós-ações)
   ▼
serviço de chamados  src/server/tickets  ── interface TicketService, banco próprio (data/tickets.db),
                                            idempotência, indisponibilidade simulada + novas tentativas
```

- **Serviço de chamados separado**: o agent e o console só falam com chamados pela interface `TicketService`; o banco `tickets.db` só é aberto dentro de `src/server/tickets` (regra de lint). O serviço simula o legado que "fica indisponível por alguns segundos" (`TICKETS_OUTAGE_RATE`, `TICKETS_OUTAGE_SECONDS`) e o cliente tenta de novo três vezes (0,5 s, 1,5 s, 3 s).
- **Persistência**: Drizzle ORM + SQLite (`data/app.db`, `data/tickets.db`) com migrations versionadas em `drizzle/`. Conversas, mensagens, decisões, rascunhos, chamados e estados sobrevivem a reinício; respostas interrompidas por um reinício voltam como "Tentar de novo" sem duplicar a mensagem do funcionário.
- **Tempo real**: Server-Sent Events. O chat assina o canal do funcionário; o console assina a lista e a conversa aberta. Ao reconectar, o cliente recarrega o snapshot.
- **Privacidade**: a identidade vem da sessão e chega às ferramentas pelo `RequestContext` do Mastra; nenhuma ferramenta recebe e-mail ou id como parâmetro. Chamado de outra pessoa volta como "não encontrado", sem confirmar que existe.

## Como o agent decide

Cada mensagem vira um turno (`src/server/agent/run-turn.ts`):

1. O servidor grava a mensagem (idempotente), confere o estado da conversa (com analista, o agent fica em silêncio) e o limite de mensagens antes de chamar o modelo.
2. O modelo recebe as instruções (regras do Anexo A, política de ferramentas) e um bloco dinâmico com o funcionário, o dispositivo, a hora em São Paulo, o rascunho pendente, o chamado em foco e o resumo herdado.
3. O modelo usa ferramentas: `list_my_tickets`, `get_ticket`, `search_help_center`, `classify_priority`, `propose_draft`, `offer_options`, `offer_ticket_selection`, `show_ticket_card`, `request_transfer`, `redirect_out_of_scope`, `close_as_resolved` e, obrigatoriamente, `record_decision` (o que entendeu, ação, confiança 0–100, porquê, regras). Cada chamada de ferramenta vira um passo publicado na hora ("consultou seus chamados", "montou o rascunho"…).
4. O que é regra fica no código, não no prompt: a prioridade e o prazo são calculados pelo servidor (o modelo só informa os fatos), o modelo não tem ferramenta que grave chamado, a reabertura só vale até 7 dias e o "Confirmar" é idempotente.
5. Depois da resposta, pós-ações em código: encerrar como resolvida (só sem rascunho pendente), transferir se a confiança ficou abaixo de 60%, transferir quando pedido (no caso crítico, logo depois de Confirmar ou Cancelar) e aplicar o limite de 30 mensagens.
6. Se o modelo esquecer o `record_decision`, o servidor pede só a decisão numa segunda chamada; se ainda faltar, grava uma decisão de reserva com confiança 0 e transfere por segurança. Mensagens do sistema (chamado criado, retomada, limite) também gravam decisão, então toda resposta tem o detalhe abrível.

## Qualidade

### Testes automatizados (`npm test`)

234 testes em Vitest, sem chamar o modelo. Os testes de integração usam bancos SQLite temporários com as migrations reais; os do turno usam o `Agent` do Mastra de verdade com um **modelo roteirizado** (`src/test/scripted-model.ts`), então ferramentas, `RequestContext`, streaming e pós-ações são exercitados de ponta a ponta.

| Suíte | O que cobre |
|-------|-------------|
| `src/server/rules/*.test.ts` | tabela de prioridade do Anexo A, horas e dias úteis (fim de semana, 18h→8h, fuso), prazo e "vencido", janela de reabertura de 7 dias |
| `src/server/tickets/*.test.ts` | serviço de chamados: numeração, privacidade por solicitante, idempotência (inclusive concorrente), notas, reabertura, indisponibilidade simulada, novas tentativas com relógio falso |
| `src/server/help-center/search.test.ts` | busca sem acento, artigo do erro 809 que não vale para Windows 11 |
| `src/server/auth`, `src/server/http`, `src/server/events` | login, cookie HMAC (expirado, adulterado), schemas de entrada, barramento e SSE com replay |
| `src/server/agent/run-turn.test.ts` | turno completo: passos e texto em streaming, decisão registrada, segunda chance e reserva sem `record_decision`, erro do modelo e "Tentar de novo" sem recontar, mensagem duplicada, analista assumindo no meio da resposta |
| `src/server/agent/tools/tools.test.ts` | cada ferramenta: chamado alheio invisível, prioridade calculada pelo servidor, substituição de rascunho, atualização e reabertura válidas, falha do serviço |
| `src/server/agent/{stream-consumer,context,post-actions}.test.ts` | ordem dos passos, coalescência do texto, bloco dinâmico, ordem e limiar das pós-ações |
| `src/server/drafts/service.test.ts` | Confirmar cria um único chamado mesmo com cliques simultâneos, serviço fora do ar mantém o rascunho, Cancelar, caso crítico confirmado e cancelado, atualização e reabertura |
| `src/server/conversations/*.test.ts` | transferência, assumir (dois analistas ao mesmo tempo), devolver, encerrar, lista do console (rótulos, filtros, busca, não lidas, "atrasada"), limite e continuação, snapshots |
| `src/server/seed`, `startup`, `messages` | dados de exemplo em qualquer hora da semana, subida/recuperação após reinício, leitura tolerante de dados antigos |
| `eval/runner.test.ts` | o executor da suíte de avaliação, com modelo roteirizado |

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### Suíte de avaliação do agent (`npm run eval`)

26 cenários roteirizados em `eval/scenarios/` cobrindo o Anexo A: dúvida pela central, artigo que não se aplica, fora de escopo, novo INC, novo REQ, "Não sei" sobre afetados, edição do rascunho, pedido de Crítica sem motivo, crítico confirmado e cancelado, pedido de analista, baixa confiança, consulta com 3/1/0 chamados abertos, vencido aceito e recusado, privacidade (número alheio e "todos os chamados do financeiro"), número inexistente, duplicado, reabertura em 4 e em 10 dias, encerramento. Cada cenário roda em bancos novos com o modelo real e confere ação, rascunho (tipo, categoria, prioridade, alvo), transferência, chamados criados, texto e vazamentos. O resultado vai para `eval/report.md` (acertos por categoria, confiança média, tokens, custo estimado, p95 de duração). Meta: ≥ 90% e zero vazamento.

```bash
npm run eval                        # todos (pausa EVAL_DELAY_MS entre turnos por causa do free tier)
npm run eval -- --only us3          # uma história ou ids separados por vírgula
```

## Modelo e custo

Google Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) pelo roteador de modelos do Mastra:

- tem free tier, então quem avalia roda o projeto e a suíte sem pagar nada;
- a cota diária do Flash-Lite comporta a suíte inteira; a do 3.8 Flash (alternativa de mais qualidade, `GEMINI_MODEL=gemini-3.8-flash`) é bem menor;
- tem chamada de ferramentas, streaming, 1M de contexto e latência baixa; o pensamento fica em nível "low" para responder rápido.

Cada resposta grava tokens e custo estimado (tabela paga: US$ 0,30 entrada / US$ 2,50 saída por milhão no Flash-Lite). `npm run cost-report` mostra o custo por conversa e as durações p50/p95. No free tier o valor cobrado é zero; os dados enviados no free tier podem ser usados pelo Google para melhorar produtos, por isso o projeto só usa dados fictícios.

## Decisões e trade-offs

- **Mastra com ferramentas, não um grafo**: preferência do desafio e menos código. O preço é a ordem das ferramentas ser decidida pelo modelo; por isso tudo que é regra (prioridade, prazo, confirmação, transferência por confiança, limite, privacidade) é aplicado pelo servidor.
- **Decisão como ferramenta (`record_decision`)**: saída estruturada junto com ferramentas não é garantida no Mastra; a ferramenta entra no mesmo fluxo dos passos e é validada com zod.
- **Serviço de chamados como módulo com banco próprio**: um processo só e nenhuma dependência extra para quem avalia; a fronteira é o contrato `TicketService`, que permite trocar por um serviço HTTP sem mexer no agent nem no console.
- **SQLite + Drizzle**: roda sem Docker e com migrations versionadas.
- **SSE em vez de WebSocket**: o fluxo é do servidor para o navegador, funciona no `next dev` e reconecta sozinho.
- **Vencido é oferecido, não transferido**: segue o protótipo; pedido, caso crítico e baixa confiança transferem sozinhos.
- **Caso crítico**: rascunho, Confirmar, cria e transfere; se o funcionário cancelar, transfere mesmo assim só com o resumo.
- **"Sessão" do limite = conversa**: no limite, o funcionário continua em uma conversa nova que herda um resumo, ou fala com um analista.
- **Edição do rascunho pela conversa**: "Editar" foca o campo; a prioridade continua vindo das regras.

## Resetar dados e desfazer

- `npm run db:reset` apaga `data/app.db` e `data/tickets.db`, migra e recarrega os dados de exemplo (`-- --keep-tickets` mantém os chamados).
- `TICKETS_OUTAGE_RATE=0` desliga a indisponibilidade simulada; `AGENT_CONFIDENCE_THRESHOLD` muda o limiar da transferência por baixa confiança; `AGENT_MESSAGE_LIMIT` muda o limite por conversa; `AGENT_TURN_TIMEOUT_MS` (padrão 90 s) é o tempo máximo de uma resposta antes de virar "Tentar de novo".

## O que eu faria com mais tempo

- Deploy com proteção da chave e limite de uso por IP.
- Testes de interface com Playwright (hoje a interface tem roteiro de QA manual) e testes das rotas HTTP.
- Roteamento por nível (N1/N2) e calendário de feriados no cálculo de horas úteis.
- Rodar a suíte de avaliação em CI a cada mudança de instruções, comparando com a execução anterior.
- Cache de prompt explícito para o bloco estático das instruções.

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | servidor de desenvolvimento em http://localhost:3000 |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm test` | testes (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript estrito |
| `npm run eval` | suíte de avaliação do agent com o modelo real |
| `npm run db:reset` | recarrega os dados de exemplo |
| `npm run cost-report` | tokens, custo e duração por conversa |
