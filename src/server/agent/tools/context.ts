import { RequestContext } from "@mastra/core/request-context";
import type { User } from "../../auth/users";
import type { AppContext } from "../../context";
import type { Conversation, TransferReason } from "../../conversations/repo";
import type { Draft } from "../../drafts/repo";
import type { CaseSummary, TicketCard, TicketSummary } from "../../messages/repo";
import type { Ticket } from "../../tickets";

/** O que as ferramentas produzem durante o turno; vira partes ricas, decisão e pós-ações. */
export interface TurnScratch {
  decisions: unknown[];
  quickOptions?: string[];
  ticketList?: TicketSummary[];
  ticketCard?: TicketCard;
  draftId?: string;
  transferRequest?: { reason: TransferReason; summary: CaseSummary };
  closeRequested: boolean;
  redirect?: { area: string; channel: string };
  /** Cache dos chamados lidos no turno (show_ticket_card reaproveita o get_ticket). */
  tickets: Map<string, Ticket>;
  focusTicket?: string;
  mentionedTickets: Set<string>;
}

/**
 * Identidade e dependências do turno. A identidade vem da sessão, nunca do modelo:
 * nenhuma ferramenta recebe e-mail ou id de funcionário como parâmetro (FR-003).
 */
export interface TurnContext {
  app: AppContext;
  employee: User;
  conversation: Conversation;
  pendingDraft: Draft | null;
  scratch: TurnScratch;
}

const TURN_KEY = "nexo.turn";

export function createTurnScratch(): TurnScratch {
  return { decisions: [], closeRequested: false, tickets: new Map(), mentionedTickets: new Set() };
}

export function createRequestContext(turn: TurnContext): RequestContext {
  const requestContext = new RequestContext();
  requestContext.set(TURN_KEY, turn);
  requestContext.set("employeeId", turn.employee.id);
  requestContext.set("conversationId", turn.conversation.id);
  return requestContext;
}

export function getTurnFromContext(requestContext: RequestContext | undefined): TurnContext | null {
  const value = requestContext?.get(TURN_KEY);
  return (value as TurnContext | undefined) ?? null;
}

export function requireTurn(context: { requestContext?: RequestContext } | undefined): TurnContext {
  const turn = getTurnFromContext(context?.requestContext);
  if (!turn) throw new Error("Ferramenta chamada fora de um turno do Nexo Assist.");
  return turn;
}
