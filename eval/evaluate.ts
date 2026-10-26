import type { Expectation, TurnObservation } from "./types";

const lower = (value: string) => value.toLocaleLowerCase("pt-BR");

/** Compara o que aconteceu no turno com o esperado; devolve as falhas em texto (vazio = passou). */
export function evaluateTurn(observation: TurnObservation, expectation: Expectation): string[] {
  const failures: string[] = [];
  const { decision, text, conversation } = observation;
  const parts = observation.agentMessages.reduce<Record<string, unknown>>((acc, m) => ({ ...acc, ...m.parts }), {});
  if (observation.error) failures.push(`erro no turno: ${observation.error}`);

  if (expectation.action) {
    const allowed = Array.isArray(expectation.action) ? expectation.action : [expectation.action];
    if (!decision || !allowed.includes(decision.action as never)) failures.push(`ação ${decision?.action ?? "(sem decisão)"} ∉ [${allowed.join(", ")}]`);
  }
  if (decision?.source === "fallback") failures.push("record_decision não foi chamada (decisão de reserva)");

  if (expectation.draft) {
    const draft = observation.newDraft;
    if (!draft) failures.push("esperava um rascunho novo neste turno");
    else {
      const e = expectation.draft;
      const effectivePriority = draft.payload.newPriority ?? draft.payload.priority;
      if (e.kind && draft.kind !== e.kind) failures.push(`rascunho kind=${draft.kind}, esperado ${e.kind}`);
      if (e.type && draft.payload.type !== e.type) failures.push(`tipo ${draft.payload.type}, esperado ${e.type}`);
      if (e.category && draft.payload.category !== e.category) failures.push(`categoria ${draft.payload.category}, esperada ${e.category}`);
      if (e.priority && effectivePriority !== e.priority) failures.push(`prioridade ${effectivePriority}, esperada ${e.priority}`);
      if (e.affected && draft.payload.affected !== e.affected) failures.push(`afetados ${draft.payload.affected}, esperado ${e.affected}`);
      if (e.targetTicket && draft.payload.targetTicket !== e.targetTicket) failures.push(`alvo ${draft.payload.targetTicket ?? "-"}, esperado ${e.targetTicket}`);
      if (e.descriptionIncludes && !draft.payload.description.includes(e.descriptionIncludes)) failures.push(`descrição não cita ${e.descriptionIncludes}`);
      if (e.hasAssumptions && draft.payload.assumptions.length === 0 && (decision?.understanding.assumptions.length ?? 0) === 0) failures.push("sem premissa registrada");
      if (e.replacedPrevious && !observation.replacedDraft) failures.push("o rascunho anterior não foi substituído");
    }
  }
  if (expectation.noDraft && observation.newDraft) failures.push(`não esperava rascunho (criou ${observation.newDraft.displayCode})`);
  if (expectation.noTicketCreated && observation.ticketsCreated > 0) failures.push(`criou ${observation.ticketsCreated} chamado(s) sem confirmação`);
  if (expectation.ticketsCreated !== undefined && observation.ticketsCreated !== expectation.ticketsCreated) failures.push(`chamados criados ${observation.ticketsCreated}, esperado ${expectation.ticketsCreated}`);

  if (expectation.transfer === false) {
    if (conversation.state !== "com_agent" && conversation.state !== "encerrada") failures.push(`transferiu sem dever (${conversation.transferReason})`);
    if (conversation.pendingTransfer) failures.push("agendou transferência sem dever");
  } else if (expectation.transfer) {
    const reasons = Array.isArray(expectation.transfer) ? expectation.transfer : [expectation.transfer];
    const transferred = conversation.state === "aguardando_atendente" || conversation.pendingTransfer;
    if (!transferred) failures.push(`esperava transferência (${reasons.join("/")}); estado ${conversation.state}`);
    else if (!conversation.transferReason || !reasons.includes(conversation.transferReason)) failures.push(`motivo ${conversation.transferReason}, esperado ${reasons.join("/")}`);
  }
  if (expectation.pendingTransfer !== undefined && conversation.pendingTransfer !== expectation.pendingTransfer) failures.push(`pendingTransfer=${conversation.pendingTransfer}`);
  if (expectation.closed !== undefined) {
    const closed = conversation.state === "encerrada";
    if (closed !== expectation.closed) failures.push(expectation.closed ? "esperava conversa encerrada" : "encerrou a conversa sem dever");
  }

  if (expectation.articleTitle && !observation.articleTitles.includes(expectation.articleTitle)) failures.push(`não usou o artigo "${expectation.articleTitle}"`);
  if (expectation.optionsInclude) {
    const options = (parts.quick_options as string[] | undefined) ?? [];
    const missing = expectation.optionsInclude.filter((o) => !options.some((x) => lower(x) === lower(o)));
    if (missing.length) failures.push(`opções sem ${missing.join(", ")} (tinha: ${options.join(" / ") || "nenhuma"})`);
  }
  const list = parts.ticket_list as Array<{ number: string }> | undefined;
  const card = parts.ticket_card as { number: string; overdue: boolean } | undefined;
  if (expectation.ticketListCount !== undefined && (list?.length ?? 0) !== expectation.ticketListCount) failures.push(`lista com ${list?.length ?? 0} chamado(s), esperado ${expectation.ticketListCount}`);
  if (expectation.noTicketList && list?.length) failures.push("mostrou lista de chamados sem dever");
  if (expectation.ticketCard) {
    if (!card || card.number !== expectation.ticketCard.number) failures.push(`card ${card?.number ?? "ausente"}, esperado ${expectation.ticketCard.number}`);
    else if (expectation.ticketCard.overdue !== undefined && card.overdue !== expectation.ticketCard.overdue) failures.push(`card overdue=${card.overdue}`);
  }
  if (expectation.noTicketCard && card) failures.push(`mostrou o card ${card.number} sem dever`);

  if (expectation.textIncludesAny && !expectation.textIncludesAny.some((t) => lower(text).includes(lower(t)))) failures.push(`texto sem nenhum de [${expectation.textIncludesAny.join(" | ")}]`);
  for (const t of expectation.textExcludes ?? []) if (lower(text).includes(lower(t))) failures.push(`texto contém "${t}"`);
  for (const tool of expectation.toolsCalled ?? []) if (!observation.toolsCalled.includes(tool)) failures.push(`não chamou ${tool}`);
  if (expectation.minConfidence !== undefined && (decision?.confidence ?? 0) < expectation.minConfidence) failures.push(`confiança ${decision?.confidence} < ${expectation.minConfidence}`);
  const custom = expectation.custom?.(observation);
  if (custom) failures.push(custom);
  return failures;
}
