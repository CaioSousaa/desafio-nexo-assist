import type { Decision } from "../decisions/repo";
import type { Message } from "../messages/repo";
import type { HistoryMessage } from "./agent";

const HISTORY_WINDOW = 40;

/**
 * Histórico enviado ao modelo: mensagens da conversa em texto puro. Respostas do agent ganham o prefixo
 * `[ações: …]` para o modelo saber o que já fez sem reenviar resultados de ferramenta (tech spec § Agent).
 */
export function buildHistory(messages: Message[], decisions: Map<string, Decision>, excludeIds: string[] = []): HistoryMessage[] {
  const exclude = new Set(excludeIds);
  const history: HistoryMessage[] = [];
  for (const message of messages) {
    if (exclude.has(message.id)) continue;
    switch (message.authorType) {
      case "funcionario":
        if (message.text.trim()) history.push({ role: "user", content: message.text });
        break;
      case "agent": {
        if (message.status !== "done" || !message.text.trim()) break;
        const decision = decisions.get(message.id);
        const labels = decision?.steps.filter((s) => s.visible).flatMap((s) => s.labels) ?? [];
        const extras: string[] = [];
        if (message.parts.quick_options?.length) extras.push(`opções: ${message.parts.quick_options.join(" / ")}`);
        if (message.parts.ticket_list?.length) extras.push(`lista: ${message.parts.ticket_list.map((t) => t.number).join(", ")}`);
        if (message.parts.ticket_card) extras.push(`card: ${message.parts.ticket_card.number}`);
        const prefix = labels.length || extras.length ? `[ações: ${[...labels, ...extras].join("; ")}] ` : "";
        history.push({ role: "assistant", content: `${prefix}${message.text}` });
        break;
      }
      case "analista":
        history.push({ role: "assistant", content: `[analista do service desk] ${message.text}` });
        break;
      case "sistema":
        history.push({ role: "assistant", content: `[evento: ${message.text}]` });
        break;
    }
  }
  return history.slice(-HISTORY_WINDOW);
}
