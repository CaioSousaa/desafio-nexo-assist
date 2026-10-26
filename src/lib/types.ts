// Tipos compartilhados com o navegador (somente tipos; nada do servidor entra no bundle).
export type {
  ChatSnapshot,
  ConversationBundle,
  ConversationView,
  MessageView,
  ConsoleConversationSnapshot,
  TicketPanel,
  TicketPanelItem,
} from "@/server/conversations/snapshot";
export type { ConsoleList, ConsoleListItem, LabelTone } from "@/server/conversations/console-list";
export type { Draft } from "@/server/drafts/repo";
export type { Decision, DecisionStep } from "@/server/decisions/repo";
export type { TicketCard, TicketSummary, MessageParts, CaseSummary } from "@/server/messages/repo";
export type { LiveStep } from "@/server/agent/stream-consumer";
export type { PublicUser } from "@/server/auth/users";
export type { ConsoleFilter } from "@/server/http/schemas";
