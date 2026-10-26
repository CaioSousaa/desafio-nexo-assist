import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { findPendingDraft } from "../../drafts/repo";
import { requireTurn } from "./context";

export const closeAsResolvedTool = createTool({
  id: "close_as_resolved",
  description:
    'Encerra a conversa como "Resolvida pelo agent" ao fim da resposta. Só funciona sem rascunho pendente e sem transferência agendada; se allowed=false, pergunte "Posso encerrar por aqui?" ou siga o fluxo.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { app, conversation, scratch } = requireTurn(context);
    const pending = await findPendingDraft(app.db, conversation.id);
    const allowed = !pending && !conversation.pendingTransfer && !scratch.draftId && !scratch.transferRequest;
    scratch.closeRequested = allowed;
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: pending ? `rascunho ${pending.displayCode} pendente` : "transferência agendada ou rascunho neste turno" };
  },
});
