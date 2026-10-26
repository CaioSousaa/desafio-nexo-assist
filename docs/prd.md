# PRD: Nexo Assist — agent do service desk de TI

**Card**: Desafio Técnico "Nexo Assist" (PDF v5, Beyond the Bytes) | **Repo**: `desafio` (greenfield, a iniciar) | **Data**: 2026-10-26 | **Status**: Aprovado (D1–D9 decididas em 2026-10-26)
**Épico / issues relacionadas**: nenhum. Deploy (diferencial do PDF) foi deliberadamente deixado fora desta iteração por decisão do usuário.

## Contexto e problema

A Nexo tem cerca de 2.000 funcionários e um service desk de TI que recebe chamados por formulário. O resultado: chamados abertos para dúvidas que a central de ajuda já responde, duplicados, prioridade errada, informações faltando e analistas gastando boa parte do dia em triagem. O desafio pede um agent de atendimento em chat que entenda o funcionário em linguagem natural, consulte seus chamados, busque na central de ajuda, abra ou atualize chamados seguindo as regras do service desk e transfira para um analista quando necessário, sempre mostrando o que fez e por quê. Não entregar significa continuar com triagem manual e chamados de baixa qualidade.

**Comportamento atual (segundo o código)**: não existe código. O diretório contém apenas o PDF do desafio. A referência de comportamento é o protótipo em Pencil (6 telas) e o próprio PDF.
**Comportamento desejado**: aplicação web local com login, chat do funcionário com o Nexo Assist, serviço de chamados simulado e separado, console do analista com transferência/assunção/devolução/encerramento, e visibilidade detalhada das decisões do agent. Tudo persistente a reinício.

## Objetivo

Entregar o Nexo Assist: um agent de service desk em chat que resolve dúvidas sem fila, abre chamados completos e sem duplicidade, encaminha ao analista na hora certa com contexto, e deixa cada decisão transparente.

## Perfis afetados

| Perfil | Como é afetado | Citado no card? |
|--------|----------------|-----------------|
| Funcionário da Nexo | Usuário principal: entra com e-mail corporativo, conversa com o agent, abre/consulta/complementa chamados, pede analista, volta outro dia | sim |
| Analista do service desk (Suporte N1 e N2) | Entra pelo mesmo login com perfil `analista`; recebe chamados criados pelo agent e conversas transferidas; assume, responde, devolve ao agent, encerra; vê chamados do funcionário | sim |
| Avaliador do processo seletivo | Roda o projeto localmente, testa as telas, lê o README e o detalhe das decisões do agent | sim (seção Entregáveis e avaliação) |
| Nexo Assist (agent) | Ator de sistema: decide a cada mensagem, usa ferramentas (central de ajuda, serviço de chamados, SLA), registra decisões | sim |
| Serviço de chamados (legado simulado) | Sistema externo simulado, separado do agent, com indisponibilidade intermitente | sim |

## Histórias de usuário

### US1 — Entrar com e-mail corporativo (Prioridade: P1)

Como **funcionário**, quero **entrar com meu e-mail corporativo e senha** para **que o agent veja só os meus chamados**.

**Por que esta prioridade**: sem identidade não há privacidade (regra inegociável do PDF) nem contexto para o agent. É pré-requisito de todas as outras histórias.
**Teste independente**: entrar com um e-mail dos dados de exemplo e qualquer senha leva ao chat; e-mail desconhecido é recusado.

**Cenários de aceite**:

1. **Dado** a tela de login, **quando** informo `ana.souza@nexo.com.br` e qualquer senha não vazia, **então** entro no chat identificada como Ana Souza, com nome e e-mail na barra lateral.
2. **Dado** a tela de login, **quando** informo um e-mail que não está nos dados de exemplo, **então** vejo a mensagem "Não encontramos esse e-mail corporativo" e permaneço na tela.
3. **Dado** que estou autenticada, **quando** clico em "Sair", **então** volto ao login e a conversa continua persistida para a próxima entrada.
4. **Dado** a tela de login, **quando** entro com a conta de um analista dos dados de exemplo, **então** sou levado ao console do analista, identificado com meu nome e nível.
5. **Dado** que estou autenticado como funcionário, **quando** tento abrir o console, **então** sou levado de volta ao chat; o inverso vale para o analista.

---

### US2 — Tirar uma dúvida sem abrir chamado (Prioridade: P1)

Como **funcionário**, quero **perguntar algo de TI e receber a resposta no chat** para **não abrir chamado por dúvida que a central de ajuda já responde**.

**Por que esta prioridade**: é a métrica "resolução sem fila" do PDF e o caso mais barato de resolver. Entrega valor mesmo sem o restante.
**Teste independente**: perguntar "qual o horário do service desk?" recebe a resposta do artigo, sem chamado e com o passo "buscou na central de ajuda" visível.

**Cenários de aceite**:

1. **Dado** o artigo "Horário do service desk", **quando** pergunto "até que horas o suporte atende?", **então** o agent responde com o conteúdo do artigo, mostra o passo "buscou na central de ajuda" e não cria chamado.
2. **Dado** o artigo "VPN com erro 809" (vale só para Windows 10) e que meu dispositivo é Windows 11, **quando** relato erro 809, **então** o agent informa que o artigo não se aplica ao meu caso e propõe abrir chamado, em vez de mandar reinstalar.
3. **Dado** uma pergunta fora de TI ("como peço férias?"), **quando** envio, **então** o agent informa que o assunto é de RH, indica o canal correto e não abre chamado.
4. **Dado** uma pergunta sem artigo correspondente e sem indício de problema, **quando** envio, **então** o agent diz que não encontrou a resposta na central de ajuda e oferece abrir chamado ou falar com um analista.
5. **Dado** que recebi a resposta, **quando** escrevo "resolveu, obrigado" ou escolho "Não, obrigado", **então** o agent se despede, a conversa é encerrada como "Resolvida pelo agent" e minha próxima mensagem abre uma nova conversa, com a anterior visível acima.
6. **Dado** um "obrigado" no meio de um fluxo em andamento (rascunho pendente ou pergunta aberta), **quando** envio, **então** o agent não encerra: continua o fluxo ou pergunta "Posso encerrar por aqui?".

---

### US3 — Abrir um chamado conversando (Prioridade: P1)

Como **funcionário**, quero **abrir um chamado só descrevendo o problema** para **que ele saia completo, com prioridade certa, e eu confira antes de criar**.

**Por que esta prioridade**: é a métrica "chamados bem abertos" e a história do analista 1 (receber chamados que não exijam perguntar tudo de novo). Concentra as regras do Anexo A.
**Teste independente**: relatar um problema novo gera perguntas só para o que falta, um rascunho com os seis campos, e o chamado só existe depois de "Confirmar".

**Cenários de aceite**:

1. **Dado** que não tenho chamado aberto sobre VPN, **quando** escrevo "Meu notebook não conecta na VPN desde ontem. Erro 809.", **então** o agent mostra os passos "consultou seus chamados" e "buscou na central de ajuda", explica o que encontrou e pergunta "Quem está sendo afetado?" com as opções "Só eu / Minha equipe / Toda a empresa / Não sei".
2. **Dado** que respondi "Só eu. Tenho reunião com cliente às 14h", **quando** o agent processa, **então** mostra os passos "classificou a prioridade", "consultou o SLA" e "montou o rascunho", explica a prioridade Alta (compromisso no mesmo dia) e exibe o rascunho com título, descrição, tipo INC, categoria "Rede e VPN", prioridade Alta com horário-limite da primeira resposta e afetados "Somente você", no estado "Aguardando confirmação".
3. **Dado** o rascunho exibido, **quando** clico em "Confirmar", **então** o chamado é criado no serviço de chamados com número INC-xxxxx, o card passa a mostrar o número e o status, e o agent confirma com o prazo de primeira resposta.
4. **Dado** o rascunho exibido, **quando** clico em "Cancelar", **então** nenhum chamado é criado e o agent confirma o cancelamento.
5. **Dado** o rascunho exibido, **quando** clico em "Editar", **então** o campo de texto recebe o foco com a dica "Diga o que quer mudar no rascunho"; **quando** escrevo "a categoria é Software", **então** o agent mostra o passo "refez o rascunho", emite um novo rascunho com a mudança, marca o anterior como substituído e explica o que mudou.
5a. **Dado** o rascunho exibido, **quando** peço "coloca como Crítica" sem que a situação se encaixe na regra, **então** o agent mantém a prioridade calculada, explica a regra (impacto e urgência) e pergunta se há algo que mude o impacto ou a urgência.
6. **Dado** que já tenho chamado aberto sobre o mesmo problema, **quando** relato o problema de novo, **então** o agent não cria chamado novo: mostra o chamado existente e propõe atualizá-lo (ver US5).
7. **Dado** um pedido de acesso ou equipamento ("preciso de um segundo monitor"), **quando** envio, **então** o rascunho sai com tipo REQ, categoria adequada e prioridade Baixa, sem perguntar "quem está sendo afetado" (afetado = eu).
8. **Dado** um relato "a rede do andar inteiro caiu" sem chamado aberto, **quando** o agent classifica, **então** anuncia que é crítico e que vai abrir o chamado e chamar um analista, mostra o rascunho com prioridade Crítica e prazo de 1 hora corrida, e a conversa fica com a transferência agendada.
9. **Dado** o rascunho crítico pendente, **quando** clico em "Confirmar", **então** o chamado é criado e, em seguida, a conversa é transferida com o resumo e o número do chamado.
10. **Dado** o rascunho crítico pendente, **quando** clico em "Cancelar", **então** nenhum chamado é criado, mas a conversa é transferida mesmo assim, com o resumo e a observação de que o funcionário não confirmou o chamado.

---

### US4 — Saber como está um chamado meu (Prioridade: P1)

Como **funcionário**, quero **perguntar o status de um chamado sem lembrar o número** para **saber se está andando ou atrasado**.

**Por que esta prioridade**: segunda consulta mais comum em service desk e base para a transferência por chamado vencido (Anexo A).
**Teste independente**: "qual o status do meu chamado?" com 3 abertos lista os três; escolher um mostra o card com prazo e vencimento.

**Cenários de aceite**:

1. **Dado** que tenho 3 chamados abertos, **quando** pergunto "qual o status do meu chamado?", **então** o agent mostra "consultou seus chamados" e uma lista selecionável com número, título, status e data de cada um.
2. **Dado** a lista, **quando** seleciono INC-20311, **então** o agent mostra "consultou o INC-20311" e "calculou o prazo", exibe o card completo (categoria, prioridade, aberto em, última atualização) com a marca "prazo vencido", explica em uma frase por que está vencido e oferece as opções "Falar com um analista / Adicionar informação / Não, obrigado".
3. **Dado** que tenho exatamente 1 chamado aberto, **quando** pergunto o status, **então** o agent vai direto ao card, sem pedir seleção.
4. **Dado** que não tenho chamado aberto, **quando** pergunto o status, **então** o agent informa que não há chamados abertos, cita o último resolvido se houver (até 7 dias) e oferece abrir um novo.
5. **Dado** que pergunto pelo número de um chamado que não é meu, **quando** envio, **então** o agent responde que não encontrou esse chamado entre os meus, sem confirmar que ele existe nem mostrar dados dele.

---

### US5 — Complementar um chamado aberto (Prioridade: P1)

Como **funcionário**, quero **adicionar informação a um chamado existente ou reabrir um recém-resolvido** para **não gerar duplicado**.

**Por que esta prioridade**: regra "sem duplicidade" do Anexo A e métrica de qualidade de chamados. Depende de US3/US4.
**Teste independente**: "o problema do INC-20311 piorou, agora nem liga" gera rascunho de atualização; confirmar adiciona nota ao chamado existente.

**Cenários de aceite**:

1. **Dado** um chamado aberto meu, **quando** escolho "Adicionar informação" ou escrevo novidades sobre ele, **então** o agent monta um rascunho de atualização (chamado alvo, texto da nota e, se a informação justificar, nova prioridade) e só grava após "Confirmar".
2. **Dado** um chamado resolvido há até 7 dias sobre o mesmo problema, **quando** relato que voltou a acontecer, **então** o agent propõe reabri-lo (rascunho de reabertura) em vez de criar outro.
3. **Dado** um chamado resolvido há mais de 7 dias sobre o mesmo problema, **quando** relato que voltou, **então** o agent propõe chamado novo e menciona o anterior na descrição.
4. **Dado** uma atualização confirmada, **quando** o analista abre o console, **então** a nota aparece no histórico do chamado com data e autor "via Nexo Assist".

---

### US6 — Ver o que o agent fez e por quê (Prioridade: P1)

Como **funcionário ou analista**, quero **ver as ações do agent acima de cada resposta e abrir o detalhe** para **entender o que ele entendeu, o que fez, com que segurança e por quê**.

**Por que esta prioridade**: o PDF declara esta a parte mais importante do desafio e critério "Transparência" na avaliação.
**Teste independente**: toda resposta do agent tem ao menos um passo visível e um detalhe abrível com entendimento, ação, confiança e justificativa.

**Cenários de aceite**:

1. **Dado** qualquer resposta do agent, **quando** ela é gerada, **então** os passos ("consultou seus chamados", "buscou na central de ajuda", "classificou a prioridade", "consultou o SLA", "montou o rascunho", "consultou o INC-xxxxx", "calculou o prazo", "criou o chamado", "atualizou o chamado", "transferiu para analista", "redirecionou") aparecem acima dela na ordem em que foram executados, com indicação de sucesso ou falha.
2. **Dado** uma resposta com passos, **quando** clico nos passos, **então** um bloco se expande logo abaixo da resposta com: "Entendi" (intenção e dados extraídos), "Decidi" (ação escolhida), "Confiança" (barra e porcentagem), "Por quê" (2 a 3 frases em linguagem simples), "Regras aplicadas" e a lista de ferramentas usadas com entrada e resultado resumidos e duração; só um bloco fica aberto por vez.
5. **Dado** a mesma conversa aberta no console, **quando** o analista clica nos passos de uma resposta do agent, **então** vê o mesmo bloco de detalhe, e no topo da conversa transferida vê o resumo da transferência com motivo e confiança.
3. **Dado** um passo que falhou (serviço de chamados indisponível), **quando** abro o detalhe, **então** vejo a falha, as tentativas feitas e como o agent reagiu.
4. **Dado** uma resposta baseada em artigo, **quando** abro o detalhe, **então** vejo o título do artigo usado.

---

### US7 — Falar com um analista (Prioridade: P2)

Como **funcionário**, quero **ser passado a um analista quando eu pedir ou quando o caso exigir** para **que uma pessoa assuma com o contexto já reunido**.

**Por que esta prioridade**: métrica "encaminhamento certo". Depende do agent funcionando (P1), mas é independente do console: a transferência já marca a conversa e pausa o agent.
**Teste independente**: "quero falar com um analista" marca a conversa como aguardando atendente, o agent para de responder, e o funcionário vê o novo estado.

**Cenários de aceite**:

1. **Dado** uma conversa com o agent, **quando** escrevo "quero falar com um analista" ou escolho a opção equivalente, **então** o agent gera um resumo do caso, a conversa passa a "aguardando atendente", aparece um evento "Transferida para o service desk · hh:mm" e o agent informa a expectativa de contato.
2. **Dado** uma conversa aguardando atendente, **quando** envio novas mensagens, **então** elas ficam registradas e visíveis ao analista, e o agent não responde.
3. **Dado** que o agent tem confiança abaixo do limiar sobre o que fazer, **quando** processa minha mensagem, **então** transfere automaticamente com o motivo "agent sem segurança" e a confiança registrada.
4. **Dado** um chamado meu vencido, **quando** consulto o status, **então** o agent oferece a transferência e só transfere se eu aceitar.
6. **Dado** um relato classificado como Crítica, **quando** o agent conclui a classificação, **então** a transferência acontece sem eu pedir, com o agent anunciando o motivo ("algo parado para uma equipe") e o resumo registrado.
5. **Dado** uma conversa transferida, **quando** o analista assume, devolve ou encerra, **então** vejo o estado mudar ("Rafael Lima está atendendo", "Nexo Assist voltou", "Atendimento encerrado") sem recarregar a página.

---

### US8 — Console: ver as conversas que precisam de mim (Prioridade: P2)

Como **analista**, quero **uma lista de conversas com filtros e status, o histórico de cada uma e os chamados do funcionário** para **saber onde sou necessário e com que contexto**.

**Por que esta prioridade**: história 2 do analista. Sem ela a transferência vira buraco negro.
**Teste independente**: com conversas em estados variados, os filtros "Todas / Para você / Com o agent / Minhas" contam e listam corretamente; abrir uma mostra o histórico e o painel de chamados.

**Cenários de aceite**:

1. **Dado** o console, **quando** abro a lista, **então** cada conversa mostra nome do funcionário, prévia da última mensagem, horário, rótulo de estado ("Transferida · INC-20311", "Agent pediu ajuda · confiança 41%", "Agent atendendo", "Você está atendendo", "Resolvida pelo agent", "Encerrada") e contador de mensagens não lidas.
2. **Dado** a lista, **quando** escolho "Para você", **então** vejo só as conversas aguardando atendente, ordenadas da mais antiga espera para a mais recente, e o contador do filtro bate com a lista.
3. **Dado** uma conversa aberta, **quando** leio o histórico, **então** distingo mensagens do funcionário, do Nexo Assist (rótulo "IA"), de analistas (nome e nível) e eventos de sistema (transferida, assumida, devolvida, encerrada) com horários.
4. **Dado** uma conversa aberta, **quando** olho o painel lateral, **então** vejo "Chamados de <nome>": os chamados desta conversa com o último evento, e os demais chamados do funcionário com status; expandir um mostra o detalhe.
5. **Dado** uma conversa aguardando atendente, **quando** a abro, **então** vejo a barra "<nome> espera um atendente · agent pausado" com "Devolver ao agent" e "Assumir atendimento", e o campo de mensagem bloqueado com "Assuma o atendimento para responder".
6. **Dado** o console aberto, **quando** uma nova conversa é transferida ou chega mensagem, **então** a lista e a conversa aberta atualizam sozinhas.
7. **Dado** a busca, **quando** digito um nome ou número de chamado, **então** a lista filtra em tempo real.

---

### US9 — Console: assumir, responder, devolver e encerrar (Prioridade: P2)

Como **analista**, quero **assumir uma conversa com o agent pausado, responder ao funcionário, devolver ao agent ou encerrar** para **resolver o que o agent não resolve**.

**Por que esta prioridade**: história 3 do analista; fecha o ciclo da transferência.
**Teste independente**: assumir libera o campo, mensagens chegam ao funcionário, devolver reativa o agent, encerrar fecha a conversa.

**Cenários de aceite**:

1. **Dado** uma conversa aguardando atendente, **quando** clico "Assumir atendimento", **então** a conversa passa a "com analista" atribuída a mim, surge o evento "Rafael Lima assumiu · agent pausado · hh:mm", o campo de mensagem é liberado, o rótulo na lista vira "Você está atendendo" e o chamado em foco (se houver) recebe a nota "Assumido por Rafael Lima" e o status "Em atendimento".
2. **Dado** que assumi, **quando** envio uma mensagem, **então** o funcionário a vê no chat com meu nome e nível, e o agent continua sem responder.
3. **Dado** uma conversa aguardando atendente ou assumida por mim, **quando** clico "Devolver ao agent", **então** a conversa volta a "com o agent", surge o evento correspondente e o agent envia uma mensagem curta de retomada ao funcionário.
4. **Dado** uma conversa assumida por mim, **quando** clico "Encerrar atendimento", **então** a conversa passa a "encerrada", o funcionário vê "Atendimento encerrado", e a próxima mensagem dele abre uma nova conversa com o agent.
5. **Dado** que outro analista já assumiu, **quando** abro a conversa, **então** vejo "Em atendimento por <nome>" e não consigo escrever nem assumir.
6. **Dado** uma conversa que está com o agent (não transferida), **quando** clico "Assumir atendimento", **então** o agent é pausado da mesma forma.

---

### US10 — Voltar outro dia e continuar de onde parei (Prioridade: P2)

Como **funcionário**, quero **reabrir o chat dias depois e ver minha conversa** para **não repetir tudo**.

**Por que esta prioridade**: história 6 do funcionário e requisito técnico de persistência a reinício. Sem isso o console e a transferência também perdem estado.
**Teste independente**: conversar, reiniciar a aplicação, entrar de novo: histórico, rascunho pendente, chamados e estado (com agent / aguardando / com analista) intactos.

**Cenários de aceite**:

1. **Dado** uma conversa com mensagens e um rascunho pendente, **quando** a aplicação é reiniciada e eu entro de novo, **então** vejo o histórico completo, o rascunho ainda aguardando confirmação e o agent continua com o contexto.
2. **Dado** uma conversa aguardando atendente, **quando** a aplicação reinicia, **então** ela continua aguardando no console e o agent continua pausado.
3. **Dado** que minha última conversa foi encerrada (pelo analista ou por limite), **quando** volto e envio mensagem, **então** vejo a conversa anterior acima, com o separador "Conversa encerrada em <data> · <motivo>", e uma nova conversa começa.

---

### US11 — Limite de mensagens por sessão (Prioridade: P2)

Como **Nexo (dona do produto)**, quero **limitar a 30 mensagens por sessão** para **controlar custo do modelo e evitar abuso**.

**Por que esta prioridade**: requisito explícito do PDF e critério "eficiência / custo por conversa". Não bloqueia as demais histórias.
**Teste independente**: o contador "N/30 mensagens nesta sessão" avança a cada mensagem do funcionário ao agent; ao chegar em 30 o comportamento definido em D2 acontece.

**Cenários de aceite**:

1. **Dado** o chat, **quando** envio uma mensagem ao agent (texto, opção rápida ou seleção de chamado), **então** o contador abaixo do campo avança em 1.
2. **Dado** 30 mensagens do funcionário ao agent na conversa atual, **quando** a 30ª é respondida, **então** o agent envia uma última mensagem explicando o limite e oferecendo "Continuar em nova conversa" e "Falar com um analista"; o campo de texto fica bloqueado.
3. **Dado** o limite atingido, **quando** escolho "Continuar em nova conversa", **então** a conversa atual é encerrada com o resultado "limite atingido", uma nova conversa começa com o contador em 0/30 e com um resumo da anterior como contexto, e o agent abre a nova conversa retomando de onde parei (ex.: "Continuando: você estava abrindo um chamado sobre a VPN…").
4. **Dado** o limite atingido, **quando** escolho "Falar com um analista", **então** a conversa atual é transferida normalmente (US7) e o contador deixa de importar.
5. **Dado** o limite atingido com um rascunho pendente, **quando** clico em "Confirmar" ou "Cancelar", **então** a ação funciona normalmente, porque não passa pelo agent nem conta como mensagem.
6. **Dado** uma conversa com analista, **quando** troco mensagens com ele, **então** o contador não avança; se a conversa voltar ao agent, o contador continua de onde estava.
7. **Dado** a nova conversa, **quando** o analista a abre no console, **então** vê a anterior encerrada com o rótulo "Encerrada · limite de mensagens" e a nova como "Agent atendendo", com o resumo herdado no topo.

---

### US12 — Meu perfil (Prioridade: P3)

Como **funcionário**, quero **ver meus dados de acesso** para **confirmar com qual conta estou falando com o service desk**.

**Por que esta prioridade**: tela presente no protótipo mas ausente da lista de telas do PDF. Zero impacto nas métricas do desafio. Entra como somente leitura, por ser barata e manter a barra lateral fiel ao protótipo (D7).
**Teste independente**: "Meu perfil" na barra lateral mostra nome, e-mail corporativo e informação de senha.

**Cenários de aceite**:

1. **Dado** o chat, **quando** clico em "Meu perfil", **então** vejo nome, e-mail corporativo (marcado "Gerenciado pela TI") e o bloco "Senha · Alterada há N dias" com o botão "Redefinir senha".
2. **Dado** a tela de perfil, **quando** clico em "Redefinir senha", **então** vejo o aviso "Indisponível neste protótipo. Fale com a TI no ramal 4000." e nada mais acontece.
3. **Dado** a tela de perfil, **quando** clico em "Atendimento", **então** volto ao chat com a conversa intacta.

## Requisitos funcionais

| ID | Requisito (testável) | História |
|----|----------------------|----------|
| FR-001 | O sistema DEVE autenticar o funcionário por e-mail corporativo presente nos dados de exemplo, aceitando qualquer senha não vazia | US1 |
| FR-002 | O sistema DEVE recusar e-mail não cadastrado com a mensagem "Não encontramos esse e-mail corporativo" | US1 |
| FR-003 | Toda consulta e ação sobre chamados no chat DEVE ser restrita ao funcionário autenticado; o sistema NÃO DEVE revelar existência, status ou conteúdo de chamado de outro funcionário, mesmo quando pedido pelo número | US1, US4 |
| FR-004 | Toda conta DEVE ter perfil `funcionario` ou `analista`; o mesmo login DEVE levar o funcionário ao chat e o analista ao console, e cada área DEVE recusar o outro perfil | US1, US8 |
| FR-005 | "Sair" DEVE encerrar a sessão e voltar ao login sem apagar conversas | US1 |
| FR-010 | O funcionário DEVE poder enviar texto livre (até 2.000 caracteres) e o agent DEVE responder em português do Brasil | US2 |
| FR-011 | Acima de cada resposta do agent, os passos executados DEVEM aparecer à medida que acontecem, e o texto da resposta DEVE aparecer de forma progressiva (não só ao final) | US2, US6 |
| FR-012 | A cada mensagem, o agent DEVE escolher exatamente uma ação principal entre: responder pela central de ajuda; consultar chamados; propor novo chamado; propor atualização ou reabertura; transferir; redirecionar (fora de TI); pedir esclarecimento; encerrar como resolvida | US2–US5, US7 |
| FR-013 | Dúvida coberta por artigo DEVE ser respondida com base nele, respeitando as condições do artigo (ex.: "vale apenas para Windows 10"), sem abrir chamado | US2 |
| FR-014 | Assunto fora de TI (RH, financeiro, facilities etc.) DEVE ser redirecionado ao canal correto, sem chamado | US2 |
| FR-015 | Quando faltar campo obrigatório do chamado, o agent DEVE perguntar, preferindo perguntas com opções rápidas, e NÃO DEVE fazer mais de 2 perguntas de esclarecimento antes de mostrar o rascunho | US3 |
| FR-016 | Antes de criar, atualizar ou reabrir chamado, o agent DEVE mostrar um rascunho com título, descrição, tipo, categoria, prioridade (com horário-limite da primeira resposta), afetados e, no caso de atualização, o chamado alvo e a nota; a gravação só ocorre após "Confirmar" | US3, US5 |
| FR-017 | A prioridade DEVE seguir a tabela do Anexo A e o prazo DEVE ser calculado em horas/dias úteis conforme a premissa de horário comercial; Crítica usa 1 hora corrida | US3, US4 |
| FR-018 | Se existir chamado aberto do mesmo funcionário sobre o mesmo problema, o agent DEVE propor atualização, nunca criar duplicado; se existir chamado resolvido há até 7 dias sobre o mesmo problema, DEVE propor reabertura | US3, US5 |
| FR-019 | Ao consultar "meu chamado" com 2+ abertos, o agent DEVE mostrar lista selecionável; com 1, ir direto ao card; com 0, informar e oferecer abertura | US4 |
| FR-020 | O card de chamado DEVE mostrar número, título, descrição, categoria, prioridade, status, aberto em, última atualização e a marca "prazo vencido" quando aplicável | US4 |
| FR-021 | Para chamado vencido, o agent DEVE informar o atraso em relação ao prazo da prioridade e oferecer "Falar com um analista / Adicionar informação / Não, obrigado" | US4, US7 |
| FR-022 | Toda afirmação do agent sobre número, status, prazo ou conteúdo de chamado e sobre artigos DEVE vir de dados retornados pelas ferramentas; o agent NÃO DEVE inventar esses dados | US2–US5 |
| FR-023 | Clicar em opção rápida ou em item da lista de chamados DEVE enviar uma mensagem do funcionário com o texto da opção, mantendo a possibilidade de digitar livremente | US3, US4 |
| FR-024 | "Editar" no rascunho DEVE focar o campo de texto com a dica "Diga o que quer mudar no rascunho"; a mudança descrita pelo funcionário DEVE gerar um novo rascunho (passo "refez o rascunho") com explicação do que mudou e do que não mudou e por quê; prioridade continua calculada pelas regras do Anexo A e NÃO DEVE ser alterada por pedido direto sem mudança de impacto ou urgência. "Cancelar" DEVE descartar o rascunho sem gravar nada, com confirmação do agent | US3 |
| FR-025 | DEVE existir no máximo um rascunho pendente por conversa; um novo rascunho substitui o anterior, que fica marcado como substituído | US3, US5 |
| FR-026 | Em falha do serviço de chamados, o agent DEVE tentar novamente (até 3 vezes) e, se persistir, informar o funcionário em linguagem simples, marcar o passo como falho e NÃO DEVE afirmar sucesso | US3–US5 |
| FR-027 | Em falha do modelo, o chat DEVE mostrar erro com "Tentar de novo"; a mensagem do funcionário permanece e não conta duas vezes no limite | US2 |
| FR-028 | O agent DEVE manter o contexto da conversa (mensagens anteriores, chamado em foco, rascunho pendente) inclusive após recarregar a página ou reiniciar a aplicação | US3, US10 |
| FR-029 | Quando o funcionário confirma que o problema foi resolvido ou recusa mais ajuda, o agent DEVE encerrar a conversa com o resultado "Resolvida pelo agent", com evento de sistema e mensagem curta de despedida; quando o sinal for ambíguo, o agent DEVE perguntar "Posso encerrar por aqui?" antes. A próxima mensagem do funcionário abre nova conversa, com a anterior visível acima e sem resumo herdado | US2, US8, US10 |
| FR-030 | Cada resposta do agent DEVE ter um registro de decisão com: o que entendeu (intenção e dados extraídos), ação escolhida, confiança (0–100%), justificativa curta, regras do service desk aplicadas e, por passo, ferramenta, entrada e resultado resumidos, duração e sucesso/falha | US6 |
| FR-031 | Clicar nos passos DEVE expandir, logo abaixo da resposta, um bloco com as seções "Entendi", "Decidi", "Confiança" (barra e %), "Por quê", "Regras aplicadas" e "Ferramentas" (nome, entrada e resultado resumidos, duração, sucesso/falha); apenas um bloco aberto por vez na conversa | US6 |
| FR-032 | Confiança abaixo do limiar DEVE gerar transferência com motivo "agent sem segurança" e a confiança visível no console | US6, US7 |
| FR-040 | Transferência automática (o agent anuncia e transfere) em três gatilhos: pedido explícito do funcionário, caso classificado como Crítica e confiança abaixo do limiar. Chamado vencido DEVE apenas gerar a oferta "Falar com um analista / Adicionar informação / Não, obrigado", transferindo só se o funcionário aceitar | US7 |
| FR-041 | Ao transferir, o sistema DEVE: mudar a conversa para "aguardando atendente"; gerar resumo do caso (problema, o que o agent já fez, chamados relacionados, prioridade, motivo) visível ao analista; registrar evento de sistema; informar o funcionário a expectativa de contato | US7 |
| FR-042 | Enquanto a conversa estiver "aguardando atendente" ou "com analista", o agent NÃO DEVE responder; mensagens do funcionário DEVEM ser registradas e visíveis ao analista | US7, US9 |
| FR-043 | O funcionário DEVE ver o estado atual da conversa (assistente online / aguardando atendente / <analista> atendendo / atendimento encerrado) e receber mensagens do analista sem recarregar a página | US7 |
| FR-044 | Em caso Crítica sem chamado aberto correspondente, o agent DEVE: anunciar a transferência, mostrar o rascunho e marcar a transferência como pendente de confirmação; ao Confirmar, criar o chamado e transferir em seguida; ao Cancelar, transferir mesmo assim só com o resumo, registrando que o chamado não foi confirmado. Em caso Crítica com chamado aberto correspondente, DEVE propor a atualização e transferir da mesma forma | US3, US7 |
| FR-050 | A lista do console DEVE mostrar, por conversa: nome do funcionário, prévia da última mensagem, horário, rótulo de estado com chamado relacionado ou confiança quando aplicável, e contador de não lidas | US8 |
| FR-051 | Filtros "Todas", "Para você" (aguardando atendente), "Com o agent", "Minhas" (assumidas pelo analista logado) DEVEM exibir contagem e filtrar a lista | US8 |
| FR-052 | A busca DEVE filtrar conversas por nome do funcionário ou número de chamado | US8 |
| FR-053 | O histórico DEVE distinguir funcionário, Nexo Assist (rótulo "IA"), analista (nome e nível) e eventos de sistema, com horários e separador de dia | US8 |
| FR-054 | O painel "Chamados de <nome>" DEVE listar os chamados desta conversa (com último evento) e os demais chamados do funcionário com status; expandir um item mostra o detalhe | US8 |
| FR-055 | "Assumir atendimento" DEVE: atribuir a conversa ao analista; pausar o agent; registrar evento; liberar o campo de mensagem; impedir que outros analistas escrevam ou assumam; anotar o chamado em foco com "Assumido por <nome>" e status "Em atendimento" | US9 |
| FR-056 | Mensagens do analista DEVEM chegar ao funcionário em tempo real, identificadas com nome e nível | US9 |
| FR-057 | "Devolver ao agent" DEVE funcionar tanto em conversa aguardando atendente quanto em conversa assumida pelo próprio analista; a conversa volta a "com o agent" e o agent envia uma mensagem curta de retomada | US9 |
| FR-058 | "Encerrar atendimento" DEVE mudar a conversa para "encerrada", registrar evento, avisar o funcionário e fazer a próxima mensagem dele abrir nova conversa | US9 |
| FR-059 | Lista e conversa aberta no console DEVEM atualizar automaticamente (novas mensagens, mudanças de estado) sem recarregar | US8 |
| FR-060 | O analista DEVE poder assumir também conversas que estão com o agent, não só as transferidas | US9 |
| FR-061 | O console DEVE mostrar o mesmo bloco de detalhe de decisão nas respostas do agent e, em conversa transferida, o resumo da transferência (motivo, confiança, problema, o que já foi feito, chamados) no topo da conversa | US6, US8 |
| FR-070 | O contador "N/30 mensagens nesta sessão" DEVE ficar visível no chat; sessão = conversa atual; contam mensagens do funcionário ao agent (texto, opção rápida, seleção de chamado); não contam Confirmar/Cancelar de rascunho nem mensagens trocadas com analista | US11 |
| FR-071 | Ao atingir 30, o agent DEVE enviar uma última mensagem com as opções "Continuar em nova conversa" e "Falar com um analista" e o campo DEVE ficar bloqueado para o agent; Confirmar/Cancelar de rascunho pendente continuam disponíveis | US11 |
| FR-072 | "Continuar em nova conversa" DEVE encerrar a conversa atual com resultado "limite atingido", gerar um resumo dela (problema, o que foi feito, chamados e rascunho pendente), abrir nova conversa com contador zerado e esse resumo como contexto, e o agent DEVE abrir a nova conversa retomando o assunto | US11, US10 |
| FR-080 | Conversas, mensagens, decisões do agent, rascunhos, chamados, eventos e o estado de cada conversa DEVEM persistir e sobreviver a reinício da aplicação | US10 |
| FR-081 | Ao reiniciar durante uma resposta do agent, a mensagem do funcionário DEVE permanecer e o chat DEVE permitir reenviar sem duplicar | US10 |
| FR-090 | A tela "Meu perfil" DEVE existir para o funcionário, somente leitura, com nome, e-mail corporativo ("Gerenciado pela TI") e bloco de senha com "Alterada há N dias" (dado de exemplo); "Redefinir senha" DEVE mostrar aviso de indisponibilidade sem outra ação | US12 |
| FR-100 | O serviço de chamados DEVE ser um componente separado do agent, acessado por contrato explícito, com operações: listar chamados do funcionário; obter chamado; criar; atualizar (nota, prioridade, status); reabrir; registrar transferência; listar chamados de um funcionário para o console | US3–US5, US8 |
| FR-101 | Os dados de exemplo DEVEM incluir: ≥ 6 funcionários (com departamento e dispositivo/SO), 2 analistas (N1 e N2), de 5 a 10 artigos da central de ajuda (incluindo os dois do Anexo B), chamados em situações variadas (aberto no prazo, vencido, resolvido há ≤ 7 dias, resolvido há > 7 dias, de outros funcionários, REQ aprovado), incluindo os três do Anexo B | US2–US5 |
| FR-104 | Os dados de exemplo DEVEM incluir de 4 a 6 conversas prontas de outros funcionários (não da conta principal de demonstração), cobrindo: aguardando atendente por pedido, aguardando atendente por baixa confiança (com confiança registrada), com o agent, resolvida pelo agent; cada mensagem do agent nessas conversas DEVE ter registro de decisão completo, para que o bloco de detalhe abra | US8 |
| FR-105 | DEVE existir um comando documentado para recarregar os dados de exemplo ao estado inicial | US8 |
| FR-102 | O serviço de chamados DEVE simular indisponibilidade intermitente (falha por alguns segundos), com taxa configurável e possibilidade de desligar | US3–US5 |
| FR-103 | O cálculo de prazo e de "vencido" DEVE ser o mesmo no chat e no console | US4, US8 |

## Regras de negócio aplicáveis

| ID | Regra | Fonte | Como o card se relaciona |
|----|-------|-------|--------------------------|
| RN-001 | Tipos: INC (algo parou ou não funciona) e REQ (pedido de acesso, equipamento ou software) | PDF, Anexo A | respeita (FR-016) |
| RN-002 | Categorias: Acesso, Rede e VPN, Hardware, Software, E-mail, Outros | PDF, Anexo A | respeita (FR-016). Protótipo mostra "Hardware › Notebook": subcategoria é detalhe livre na descrição, não campo |
| RN-003 | Todo chamado precisa de título, descrição, tipo, categoria, prioridade e de quem é afetado; o agent mostra rascunho e só cria ou atualiza após confirmação | PDF, Anexo A | respeita (FR-016), inclusive em caso crítico (D5; FR-044) |
| RN-004 | Sem duplicidade: chamado aberto sobre o mesmo problema é atualizado; resolvido há até 7 dias pode ser reaberto | PDF, Anexo A | respeita (FR-018) |
| RN-005 | Transferência: quando o funcionário pede, em casos críticos, em chamados vencidos ou quando o agent não tem segurança; leva resumo; agent não responde enquanto a conversa está com analista | PDF, Anexo A | respeita com a leitura do protótipo: vencido é oferecido, os demais são automáticos (D4; FR-040 a FR-042) |
| RN-006 | Privacidade: informações de um chamado só a quem o abriu | PDF, Anexo A e Requisitos | respeita (FR-003). Analista vê chamados do funcionário da conversa (premissa) |
| RN-007 | Escopo: apenas TI; RH, financeiro, facilities são redirecionados | PDF, Anexo A | respeita (FR-014) |
| RN-008 | Prioridade = impacto (quantas pessoas) + urgência (compromisso em risco). Crítica 1 h; Alta 4 h úteis; Média 3 dias úteis; Baixa 5 dias úteis. Prazo vale para primeira resposta e para cada atualização; passado o prazo, vencido | PDF, Anexo A | respeita (FR-017, FR-103) |
| RN-009 | Horário do service desk: segunda a sexta, 8h às 18h; críticos têm plantão 24 h | PDF, Anexo B (artigo) | base do cálculo de horas úteis (premissa) |
| RN-010 | Limite de 30 mensagens por sessão | PDF, O que construir | respeita; definição em D2 |
| RN-011 | Chaves fora do código; chamados de um funcionário nunca expostos a outro | PDF, Requisitos técnicos | respeita (FR-003; `.env.example`) |

## Entidades-chave

- **Funcionário**: nome, e-mail corporativo, departamento, dispositivo (modelo e sistema operacional, usado pelo agent para aplicar condições de artigos), perfil `funcionario`. Dados de exemplo.
- **Analista**: nome, e-mail corporativo, nível (N1 ou N2), perfil `analista`. Entra pelo mesmo login. Dados de exemplo.
- **Conversa**: pertence a um funcionário; estado `com_agent` → `aguardando_atendente` → `com_analista` → `encerrada` (com retornos `aguardando_atendente`/`com_analista` → `com_agent` via "Devolver"); motivo e resumo da transferência; analista atribuído; chamados relacionados; resultado (`resolvida_pelo_agent`, `encerrada_pelo_analista`, `limite_atingido`); contador de mensagens ao agent; resumo herdado da conversa anterior (quando continuada por limite). Um funcionário tem no máximo uma conversa não encerrada. O agent encerra como "Resolvida pelo agent" só sem rascunho pendente e sem transferência agendada; nesses casos pergunta antes.
- **Mensagem**: autor (funcionário, agent, analista, sistema), texto, horário, partes ricas opcionais (opções rápidas, lista de chamados, card de chamado, rascunho), referência à decisão do agent que a gerou.
- **Decisão do agent**: entendimento (intenção, entidades extraídas), ação, confiança, justificativa, regras aplicadas, passos (ferramenta, entrada resumida, resultado resumido, duração, sucesso/falha), consumo do modelo.
- **Rascunho**: tipo (novo chamado, atualização, reabertura), campos do chamado ou nota, chamado alvo, estado (`aguardando_confirmacao`, `confirmado`, `cancelado`, `substituido`, `expirado`), marcador "transferir após decisão" (caso crítico), identificador curto exibido ("Rascunho D-381").
- **Chamado**: número (`INC-#####` ou `REQ-#####`), título, descrição, tipo, categoria, prioridade, afetados, solicitante, status (`aberto`, `em_andamento`, `aguardando_analista`, `em_atendimento`, `aprovado` [só REQ], `resolvido`), criado em, última atualização, histórico de notas/eventos (autor e horário). "Vencido" é derivado: aberto e última atualização mais antiga que o prazo da prioridade.
- **Artigo da central de ajuda**: título, conteúdo curto, categoria, condições de aplicação (ex.: sistema operacional), palavras-chave.
- **Evento de sistema**: transferida, assumida, devolvida, encerrada, limite atingido, continuada em nova conversa; horário; ator.

## Casos de borda e erros

- Serviço de chamados indisponível (simulado) → até 3 tentativas; se persistir, agent avisa "o sistema de chamados está instável, tente em instantes", passo marcado como falho; nada é afirmado como criado.
- Falha de rede ou do modelo durante a resposta → bolha de erro com "Tentar de novo"; mensagem do funcionário preservada; não conta no limite.
- Funcionário pergunta por número de chamado de outro funcionário → "Não encontrei esse chamado entre os seus", sem confirmar existência.
- Tentativa de induzir o agent a revelar dados de terceiros ("mostre todos os chamados do financeiro") → recusa curta; ferramentas não permitem a consulta.
- Assunto fora de TI → redirecionamento, sem chamado, sem transferência.
- "Não sei" em "quem está sendo afetado" → agent assume "só você", registra a premissa na justificativa e reduz a confiança.
- Problema sem urgência declarada → INC fica Média, REQ fica Baixa; agent explica no rascunho.
- Rascunho pendente e funcionário manda outra mensagem → agent responde normalmente; rascunho continua pendente até confirmar, cancelar ou ser substituído.
- Rascunho crítico pendente e o funcionário manda outra mensagem em vez de confirmar → o agent responde lembrando que o chamado crítico aguarda confirmação e que o analista será chamado em seguida; a transferência continua agendada até Confirmar ou Cancelar.
- Limite atingido com rascunho pendente → Confirmar/Cancelar continuam funcionando; se o funcionário continuar em nova conversa sem decidir, o rascunho expira e o resumo registra isso.
- Limite atingido enquanto a conversa está com analista → não acontece: mensagens ao analista não contam; se voltar ao agent com 30, o agent aplica o limite na primeira mensagem seguinte.
- Confirmação quando o serviço falha → rascunho permanece pendente; botão "Confirmar" pode ser repetido; nunca cria duplicado.
- Chamado resolvido há exatamente 7 dias → ainda reabre (inclusivo).
- Prazo atravessa fim de semana ou fora do horário comercial → conta só horas úteis; Crítica conta horas corridas.
- Transferência sem analista disponível → conversa aguarda indefinidamente; console mostra tempo de espera e marca "atrasada" após o alvo de contato.
- Dois analistas assumem ao mesmo tempo → o primeiro vence; o segundo vê "Em atendimento por <nome>".
- Analista assume enquanto o agent gera resposta → a resposta em andamento é concluída e entregue; a partir daí o agent fica pausado.
- Funcionário manda mensagem logo após o agent encerrar como resolvida → nova conversa abre normalmente; o agent tem o histórico anterior visível para o funcionário, mas trata como conversa nova (sem resumo herdado); se o assunto for o mesmo, a consulta de chamados cobre a continuidade.
- Analista encerra enquanto o funcionário digita → o funcionário vê "Atendimento encerrado"; a mensagem enviada em seguida abre nova conversa.
- Funcionário recarrega durante o streaming → ao voltar vê a resposta completa quando concluída.
- Estados vazios: primeiro acesso do funcionário (mensagem de boas-vindas do agent com exemplos do que ele faz); filtro do console sem conversas ("Nenhuma conversa aqui"); funcionário sem chamados ("Nenhum chamado").
- Estados de carregamento: passos do agent aparecem um a um com indicador; lista do console com esqueleto; botões de ação do console desabilitados durante a operação.
- Mensagem acima de 2.000 caracteres → campo impede o envio e informa o limite.

## Critérios de sucesso

| ID | Critério mensurável | Como medir |
|----|---------------------|------------|
| SC-001 | Em um conjunto de ≥ 20 cenários roteirizados cobrindo o Anexo A (dúvida, fora de escopo, novo INC, novo REQ, duplicado, reabertura ≤ 7 dias, > 7 dias, consulta ambígua, vencido, crítico, pedido de analista, privacidade), o agent escolhe a ação correta em ≥ 90% | suíte de avaliação automatizada executada antes da entrega, resultado no README |
| SC-002 | 100% das criações, atualizações e reaberturas de chamado são precedidas de rascunho confirmado | teste automatizado + inspeção do histórico de eventos |
| SC-003 | Zero exposições de chamado de um funcionário a outro nos cenários de privacidade | suíte de avaliação |
| SC-004 | 100% das respostas do agent têm ao menos um passo visível e um detalhe abrível com entendimento, ação, confiança e justificativa | inspeção das telas + teste |
| SC-005 | Primeiro sinal visível (passo ou texto) em até 2 s após o envio, e resposta completa em até 10 s, em 95% das mensagens em execução local | medição registrada por decisão |
| SC-006 | Após reiniciar a aplicação, 100% das conversas, chamados, rascunhos e estados são recuperados | teste de reinício |
| SC-007 | Projeto roda localmente com no máximo 3 comandos documentados no README, a partir de um `.env.example` | leitura do README por terceiro |
| SC-008 | 100% dos chamados criados pelo agent têm os seis campos obrigatórios preenchidos | consulta aos dados do serviço de chamados |
| SC-009 | Custo médio por conversa registrado e reportado no README (tokens e valor estimado) | contabilização por decisão do agent |

## Fora de escopo

- Deploy e proteções de deploy (limite de uso por IP, chaves em plataforma). Decisão do usuário para esta iteração.
- Autenticação real (SSO, validação de senha, redefinição funcional, "Esqueci minha senha", "Ligue no ramal 4000"): links e botões ficam visíveis como no protótipo, sem ação ou com aviso curto.
- Integração com sistema de chamados real; o serviço simulado é o único.
- Analista editar, resolver ou fechar chamados pelo console; o painel é somente leitura (exceto as notas automáticas de assunção/encerramento).
- Alternância funcional do status "Disponível" do analista; o indicador é visual.
- Roteamento por nível (N1/N2): fila única; o nível é atributo do analista exibido nas mensagens.
- Layout mobile; o protótipo é desktop (1440×900).
- Mais de uma conversa aberta por funcionário; lista de conversas no lado do funcionário.
- Anexos, imagens e áudio.
- Notificações por e-mail ou push.
- Métricas da tela de login ("8 s", "72%", "6 analistas online"): texto estático.
- Calendário de feriados no cálculo de horas úteis.
- Tela "Ver todos os chamados" do analista: o painel já lista todos.
- Cancelamento de transferência pelo funcionário.
- Internacionalização; produto é pt-BR.
- Painel administrativo para editar dados de exemplo.

## Premissas

- O repositório será iniciado neste diretório (`desafio`), ainda sem git. `prd.md` não entra nos commits.
- "Tempo real" significa: passos do agent aparecem conforme executam, texto da resposta aparece progressivamente, e chat do funcionário e console refletem novas mensagens e mudanças de estado em poucos segundos sem recarregar. Fonte: requisito 2 do PDF e "digitando…" no protótipo.
- Horário comercial para horas/dias úteis: segunda a sexta, 08:00–18:00, fuso America/Sao_Paulo, sem feriados. Crítica usa 1 hora corrida (plantão 24 h). Fonte: artigo do Anexo B.
- O prazo exibido no rascunho é o horário-limite da primeira resposta calculado a partir de agora (protótipo: "resposta até 13:43").
- "Vencido" é derivado da última atualização e da prioridade, não é status. Fonte: Anexo A.
- Conjunto de status de chamado unificado a partir de Anexo A, Anexo B e protótipo: aberto, em andamento, aguardando analista, em atendimento, aprovado (REQ), resolvido. "Reaberto" volta para aberto com nota.
- O registro do funcionário inclui dispositivo e sistema operacional; é assim que o agent sabe que "o seu é Windows 11" sem perguntar (protótipo, Tela 2).
- Limiar de confiança para transferência automática: 60%. Abaixo disso o agent transfere com motivo "sem segurança". Valor configurável. Fonte: protótipo mostra "confiança 41%" como caso de pedido de ajuda.
- Alvo informativo de primeiro contato humano após transferência: 2 horas úteis (protótipo: "em até 2 h úteis", "até 12:05", "contato em 25 min"). Passado o alvo, o console marca "atrasada"; não há devolução automática ao agent. O Anexo A não define esse prazo.
- Transferência vai para fila única do service desk; a mensagem ao funcionário cita "service desk", não "Suporte N2", já que não há roteamento por nível.
- Resumo da transferência é gerado pelo agent e fica no topo da conversa no console (com motivo e confiança), não como mensagem ao funcionário.
- O bloco de detalhe usa linguagem de leigo nas seções "Entendi", "Decidi" e "Por quê"; a seção "Ferramentas" é a única com nomes técnicos (nome da ferramenta, parâmetros resumidos).
- O analista vê todos os chamados do funcionário da conversa aberta (abertos e encerrados). Analistas já têm acesso ao sistema de chamados; a regra de privacidade protege funcionário de funcionário.
- Analista pode assumir qualquer conversa não encerrada, inclusive as que estão com o agent (história 3 do analista não restringe).
- Enquanto aguarda atendente ou está com analista, o funcionário continua podendo escrever; o agent fica em silêncio.
- Ao devolver ao agent, o agent envia uma mensagem curta de retomada (ex.: "Voltei. Posso continuar ajudando com o INC-20311?").
- Eventos de assunção e encerramento geram nota no chamado em foco; assunção muda o status para "em atendimento"; encerramento da conversa não altera o status do chamado (quem resolve chamado é o sistema de chamados, fora de escopo).
- Opções rápidas e seleção de chamado enviam uma mensagem do funcionário com o texto escolhido (protótipo: "INC-20311 · Notebook lento após atualização" aparece como mensagem do funcionário).
- Contam no limite de mensagens: textos, opções rápidas e seleções enviados ao agent. Não contam: cliques em Confirmar/Cancelar do rascunho e mensagens trocadas com analista. Ao voltar do analista para o agent, a contagem continua na mesma conversa.
- O resumo herdado ao continuar em nova conversa é gerado pelo agent, aparece como nota de sistema no início da nova conversa (visível ao funcionário e ao analista) e entra no contexto do agent; a conversa anterior fica visível acima, encerrada. Rascunho pendente da conversa anterior é marcado como expirado e citado no resumo para o agent propor de novo se fizer sentido.
- O agent faz no máximo 2 perguntas de esclarecimento antes do rascunho; o que faltar vira premissa declarada no rascunho e na justificativa (evita interrogatório; critério "condução da conversa").
- "Não sei" em afetados → assume "só você" e reduz confiança.
- Duplicidade é julgamento do agent sobre os chamados abertos do funcionário, com a comparação registrada na justificativa (quais chamados considerou e por que decidiu igual/diferente).
- Atualização de chamado = nota no histórico, podendo propor nova prioridade; ambos passam pelo rascunho.
- Mensagem de edição de rascunho conta no limite de mensagens como qualquer outra mensagem ao agent.
- Serviço de chamados simula indisponibilidade com taxa padrão de 10% das chamadas por alguns segundos, configurável e desligável para testes (o mecanismo fica para a tech spec). Fonte: "fica indisponível por alguns segundos" no PDF.
- Dados de exemplo usam datas relativas ao momento da carga, para que o INC-20311 esteja sempre vencido e o INC-20150 sempre dentro dos 7 dias de reabertura.
- Nomes dos dados de exemplo espelham o protótipo (Ana Souza, Carla Mendes, Bruno Tavares, Diego Ramos, Elisa Prado, Fábio Nunes, Gabriela Rocha; analistas Rafael Lima N2 e um N1) para fidelidade visual.
- Ana Souza é a conta principal de demonstração e começa sem conversa (primeiro acesso com boas-vindas do agent), para que o avaliador viva o fluxo do zero. As conversas prontas pertencem aos demais funcionários e podem ser assumidas, devolvidas e encerradas no console; o lado do funcionário delas só responde se alguém entrar com aquela conta.
- Conversas prontas são escritas à mão, com registros de decisão no mesmo formato dos reais (sem chamar o modelo na carga), e podem ser restauradas pelo comando de recarga.
- Links "Esqueci minha senha", "Ligue no ramal 4000", "Privacidade e uso de dados" e "Redefinir senha" são visuais; ao clicar mostram aviso curto de que não estão disponíveis neste protótipo.
- "Manter conectado neste computador" controla a duração da sessão de login (sessão de navegador vs. 30 dias).
- Texto da tela de login fica neutro ("Use seu e-mail corporativo"), válido para funcionário e analista; o README lista as contas de exemplo de cada perfil.
- E-mail não cadastrado recebe mensagem explícita (não genérica): este é um protótipo de avaliação e o README lista as contas; clareza vale mais que ocultar enumeração.
- Mensagens de erro e textos do agent em português do Brasil; identificadores de código em inglês.
- Contagem de "não lidas" no console = mensagens do funcionário desde a última abertura da conversa pelo analista logado.
- Separador "Hoje" e horários no console seguem o fuso America/Sao_Paulo.

## Incongruências encontradas

| # | Fonte A diz | Fonte B diz | Resolução |
|---|-------------|-------------|-----------|
| 1 | PDF, Anexo C: 5 telas | Protótipo: 6 telas, inclui "Cliente — Meu perfil" e link "Meu perfil" na barra lateral | Decisão D7: construir somente leitura |
| 2 | PDF: login aceita funcionários dos dados de exemplo | Console é do analista; PDF não diz como o analista entra | Decisão D1: mesmo login, perfil na conta |
| 3 | Anexo A: transferência "acontece" em chamados vencidos | Protótipo, Tela 3: agent pergunta "Quer que eu chame um analista?" | Decisão D4: vencido é oferecido; pedido, crítico e baixa confiança são automáticos |
| 4 | Anexo A: só cria chamado após confirmação | Anexo A: caso crítico transfere; protótipo não mostra o fluxo crítico | Decisão D5: rascunho, confirmação, cria, transfere; cancelar transfere sem chamado |
| 5 | PDF: "limite de 30 mensagens por sessão" | História 6: voltar outro dia e continuar; conversa não termina | Decisão D2: sessão = conversa; no limite, nova conversa com resumo herdado ou transferência |
| 6 | PDF: ver em detalhe o que entendeu, ação, confiança e por quê; formato livre | Protótipo mostra só os passos em linha | Decisão D3: bloco inline expansível, igual no chat e no console |
| 7 | PDF: console lista conversas e transfere/devolve/encerra | Protótipo: rótulo "Resolvida pelo agent"; PDF nunca diz que o agent encerra conversa | Decisão D9: agent encerra ao confirmar solução ou recusar ajuda |
| 8 | Protótipo: botão "Editar" no rascunho | PDF: nada sobre edição | Decisão D6: edição pela conversa, novo rascunho |
| 9 | Anexo A: sem prazo para contato humano | Protótipo: "em até 2 h úteis", "até 12:05", "contato em 25 min" | Premissa: alvo informativo de 2 h úteis, sem devolução automática |
| 10 | Protótipo: "Encaminhei para o Suporte N2" | PDF: analista é N1 e N2; sem regra de roteamento | Premissa: fila única; nível é atributo do analista |
| 11 | Anexo B: status "Aguardando analista", "Aprovado", "Resolvido" | Protótipo: também "Em andamento", "Em atendimento"; Anexo A: "aberto", "resolvido", "vencido" | Premissa: conjunto unificado; vencido derivado |
| 12 | Protótipo: agent sabe que o notebook é Windows 11 sem o funcionário dizer | PDF: não descreve dados do funcionário | Premissa: registro do funcionário tem dispositivo/SO |
| 13 | PDF: "respostas em tempo real" | Sem definição | Premissa: passos progressivos, texto progressivo, atualização automática dos dois lados |
| 14 | PDF: serviço legado "fica indisponível por alguns segundos" | Não diz se o simulado deve reproduzir | Premissa: simula, configurável, padrão ligado |
| 15 | Protótipo, Tela 4: "Devolver ao agent" antes de assumir | PDF: "assumir, devolver e encerrar" (ordem sugere após assumir) | Premissa: devolver funciona nos dois estados (FR-057) |
| 16 | Protótipo, Tela 5: chamado passa a "Em atendimento" quando analista assume | PDF: console só lista chamados | Premissa: assunção anota e muda status do chamado em foco |
| 17 | Anexo B: INC-20311 "há 6 dias" | Protótipo: "há 5 dias" | Irrelevante; datas relativas à carga |
| 18 | Protótipo: "Hardware › Notebook" | Anexo A: 6 categorias sem subcategoria | Premissa: subcategoria não é campo; detalhe fica na descrição |
| 19 | Protótipo, login: "8 s", "72%", "6 analistas online" | PDF: nada | Fora de escopo: texto estático |
| 20 | Protótipo, console: 7 conversas em estados variados | PDF, Anexo B: dados de exemplo citam funcionários, artigos e chamados; não citam conversas | Decisão D8: carregar 4 a 6 conversas prontas de outros funcionários |

## Impacto em outros repositórios e integrações

- Nenhum repositório irmão. Projeto único e novo.
- Componentes internos com contrato compartilhado: interface (chat e console), agent, serviço de chamados simulado, central de ajuda. O contrato do serviço de chamados é usado pelo agent e pelo console; a tech spec define o formato e a fronteira de processo.
- Integração externa: provedor de LLM (escolha e justificativa na tech spec e no README). Chave fora do código, como exige o PDF.

## Para a Tech Spec

- Mastra (preferência do PDF) vs LangGraph.js; como representar a decisão estruturada (entendimento, ação, confiança, justificativa) e os passos.
- Provedor e modelo de LLM: custo por conversa, latência, saída estruturada, streaming; justificar no README.
- Next.js único (interface + API) vs SPA + API separada; onde fica o serviço de chamados (processo separado com HTTP vs módulo atrás de interface) e como simular a indisponibilidade.
- Persistência: SQLite em arquivo vs Postgres local; esquema para conversa, mensagem, decisão, rascunho, chamado, evento.
- Transporte do tempo real: SSE vs WebSocket vs polling, para streaming do agent e para o console.
- Busca na central de ajuda: palavras-chave vs embeddings, dado o tamanho (5–10 artigos).
- Suíte de avaliação do agent (SC-001): formato dos cenários, execução determinística, custo.
- Limiar de confiança e como o modelo o reporta de forma calibrada; fallback determinístico.
- Controle de concorrência na assunção (dois analistas) e idempotência do "Confirmar".
- Cálculo de horas úteis (biblioteca ou implementação própria) e testes.
- Sessão e autenticação simples (cookie assinado), perfis e redirecionamento.
- Estratégia de dados de exemplo com datas relativas; comando de reset.
- Estratégia de testes: unidade (prioridade, prazo, duplicidade, privacidade), integração (serviço de chamados, falhas), avaliação do agent.
- Conteúdo do `.env.example`, comandos de execução, plano de commits que contem a história.
- Contabilização de tokens/custo por decisão (SC-009).

## Decisões

- D1 — Como o analista acessa o console? → Mesmo login; conta com perfil `funcionario` ou `analista`; redirecionamento por perfil; cada área recusa o outro perfil — identidade é pré-requisito de autorização: o console mostra dados de vários funcionários e precisa de usuário autenticado e autorizado; evita tela extra.
- D2 — O que é "sessão" no limite de 30 mensagens e o que acontece no limite? → Sessão = conversa atual (episódio). Contam só mensagens do funcionário ao agent. No limite, o agent oferece "Continuar em nova conversa" (encerra a atual, abre nova com contador zerado e resumo da anterior como contexto) ou "Falar com um analista" — casa com o ciclo de vida da conversa e com o texto "nesta sessão"; o resumo herdado preserva "continuar de onde parei"; o usuário aceita que o controle de custo por conversa seja fraco, pois cada nova conversa custa um resumo e recomeça a contagem.
- D3 — Onde e como aparece o detalhe de cada decisão do agent, e quem vê? → Passos clicáveis expandem bloco inline sob a resposta (Entendi / Decidi / Confiança / Por quê / Regras aplicadas / Ferramentas), mesmo componente no chat e no console; console ganha o resumo da transferência no topo — explicação mora ao lado do que explica, e o analista que herda a decisão precisa do porquê tanto quanto o funcionário.
- D4 — Quais gatilhos de transferência são automáticos e quais são oferecidos? → Automáticos: pedido explícito, caso Crítica, confiança abaixo do limiar. Oferecido: chamado vencido, como no protótipo — automatize o que tem custo alto de atraso e deixe ao usuário o que é só informação; o protótipo oficial desempata a leitura literal do Anexo A.
- D5 — Em caso crítico sem chamado, criar antes de transferir? → Sim, em sequência: rascunho, confirmação, cria, transfere; se cancelar, transfere só com o resumo — quando duas regras colidem (confirmar antes de criar vs. agir rápido), sequencie e garanta que a falta de resposta não bloqueie a ação mais importante.
- D6 — Como funciona "Editar" no rascunho? → Pela conversa: o botão foca o campo com dica, o funcionário descreve a mudança e o agent emite novo rascunho explicando o que mudou; prioridade segue as regras — em produto conversacional a conversa é a interface de edição, e campo calculado por regra não se expõe a edição livre.
- D7 — Tela "Meu perfil": construir ou tirar do escopo? → Construir somente leitura (nome, e-mail, bloco de senha), com "Redefinir senha" mostrando aviso de indisponibilidade — está no protótipo e na barra lateral, custa pouco e evita link morto; autenticação real segue fora de escopo.
- D8 — Carregar conversas de exemplo no console ou começar vazio? → Carregar 4 a 6 conversas prontas de outros funcionários em estados variados, com registros de decisão completos; a conta principal (Ana) começa do zero — o avaliador precisa ver filtros, rótulos e assunção funcionando sem simular sete funcionários, e ainda viver o fluxo completo com a conta principal.
- D9 — O agent pode encerrar a conversa como "resolvida"? → Sim, quando o funcionário confirma solução ou recusa mais ajuda; em sinal ambíguo pergunta antes; próxima mensagem abre nova conversa com a anterior visível — o ciclo de vida reflete o estado real do atendimento, e corrigir um encerramento errado custa só mandar outra mensagem.

## Pendências

Nenhuma.

## Evidências

Não há código. Fontes do comportamento esperado:

- `/home/caio/Documentos/dev/desafio/Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf` → páginas 1–3: contexto, histórias, o que construir, requisitos técnicos, avaliação; página 4: Anexo A (regras) e Anexo B (dados de exemplo); página 5: Anexo C (lista de telas).
- `/home/caio/Downloads/nexo.pen` (protótipo Pencil, lido via MCP) → frames: `bi8Au` Identificação (login); `IcuoM` Chat — Novo chamado (perguntas com opções, passos, rascunho com Confirmar/Editar/Cancelar, contador 18/30); `vbsNW` Chat — Consulta e transferência (lista selecionável, card com prazo vencido, oferta de analista, contador 16/30); `x2HBOE` Atendente — Conversas (rail, lista com filtros e rótulos, conversa aguardando com "Devolver ao agent" e "Assumir atendimento", painel "Chamados da Ana"); `CAqx8` Atendente — Atendimento assumido (eventos de sistema, mensagem do analista, "Devolver ao agent" e "Encerrar atendimento", chamado "Em atendimento"); `i4fCbC` Cliente — Meu perfil.
