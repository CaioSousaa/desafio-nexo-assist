// Ferramenta → rótulo do passo exibido acima da resposta (FR-011). Ferramentas sem rótulo aparecem só no detalhe.

type Args = Record<string, unknown>;
type Result = Record<string, unknown> | null | undefined;

export interface StepLabels {
  labels: string[];
  visible: boolean;
}

export function stepLabels(tool: string, args: Args, result: Result): StepLabels {
  switch (tool) {
    case "list_my_tickets":
      return { labels: ["consultou seus chamados"], visible: true };
    case "get_ticket": {
      const number = String(args.number ?? "").toUpperCase();
      const found = result?.found === true;
      return { labels: found ? [`consultou o ${number}`, "calculou o prazo"] : [`consultou o ${number}`], visible: true };
    }
    case "search_help_center":
      return { labels: ["buscou na central de ajuda"], visible: true };
    case "classify_priority":
      return { labels: ["classificou a prioridade", "consultou o SLA"], visible: true };
    case "propose_draft":
      return { labels: [result?.replaced === true ? "refez o rascunho" : "montou o rascunho"], visible: true };
    case "request_transfer":
      return { labels: ["transferiu para analista"], visible: true };
    case "redirect_out_of_scope":
      return { labels: ["redirecionou"], visible: true };
    default:
      return { labels: [], visible: false };
  }
}

const truncate = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function summarizeInput(tool: string, args: Args): string {
  switch (tool) {
    case "list_my_tickets":
      return `includeResolvedDays=${String(args.includeResolvedDays ?? 30)}`;
    case "get_ticket":
    case "show_ticket_card":
      return `number=${String(args.number ?? "")}`;
    case "search_help_center":
      return `query="${truncate(String(args.query ?? ""), 80)}"`;
    case "classify_priority":
      return `kind=${String(args.kind)} impact=${String(args.impact)} blocksWork=${String(args.blocksWork)} sameDayCommitment=${String(args.sameDayCommitment)} hasWorkaround=${String(args.hasWorkaround)}`;
    case "propose_draft":
      return `kind=${String(args.kind)} type=${String(args.type)} category=${String(args.category)}${args.targetTicket ? ` target=${String(args.targetTicket)}` : ""}`;
    case "offer_options":
      return `options=${JSON.stringify(args.options ?? [])}`;
    case "offer_ticket_selection":
      return `numbers=${JSON.stringify(args.numbers ?? [])}`;
    case "request_transfer":
      return `reason=${String(args.reason)}`;
    case "redirect_out_of_scope":
      return `area=${String(args.area)}`;
    case "record_decision":
      return `action=${String(args.action)} confidence=${String(args.confidence)}`;
    default:
      return truncate(JSON.stringify(args));
  }
}

export function summarizeOutput(tool: string, result: Result): string {
  if (!result) return "sem resultado";
  if (typeof result.error === "string") return `falhou: ${String(result.message ?? result.error)}`;
  switch (tool) {
    case "list_my_tickets": {
      const tickets = Array.isArray(result.tickets) ? (result.tickets as Array<Record<string, unknown>>) : [];
      const overdue = tickets.filter((t) => t.overdue === true).length;
      const open = tickets.filter((t) => t.status !== "resolvido").length;
      return `${tickets.length} chamado(s), ${open} aberto(s)${overdue ? `, ${overdue} vencido(s)` : ""}`;
    }
    case "get_ticket":
      if (result.found !== true) return "não encontrado entre os chamados do funcionário";
      return `${String((result.ticket as Args | undefined)?.status ?? "")}${(result.sla as Args | undefined)?.overdue ? " · prazo vencido" : " · no prazo"}`;
    case "search_help_center": {
      const articles = Array.isArray(result.articles) ? (result.articles as Array<Record<string, unknown>>) : [];
      if (articles.length === 0) return "nenhum artigo encontrado";
      return articles.map((a) => `${String(a.title)}${a.appliesToEmployee === false ? " (não se aplica)" : ""}`).join("; ");
    }
    case "classify_priority":
      return `${String(result.priority)} · ${String(result.deadlineText ?? "")}`;
    case "propose_draft":
      return `rascunho ${String(result.displayCode)} · ${String(result.priority)}`;
    case "request_transfer":
      return "transferência agendada";
    default:
      return truncate(JSON.stringify(result));
  }
}
