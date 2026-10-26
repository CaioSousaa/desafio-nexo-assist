import type { AppContext } from "@/server/context";
import type { Conversation, TransferReason } from "@/server/conversations/repo";
import type { Decision } from "@/server/decisions/repo";
import type { Draft } from "@/server/drafts/repo";
import type { Message } from "@/server/messages/repo";

/**
 * Ações do registro de decisão. FR-012 lista 8 ações; "propor atualização ou reabertura" virou duas
 * (`propor_atualizacao` e `propor_reabertura`) para a suíte distinguir duplicado de reabertura (achado 5).
 */
export type EvalAction =
  | "responder_central"
  | "consultar_chamados"
  | "propor_chamado"
  | "propor_atualizacao"
  | "propor_reabertura"
  | "transferir"
  | "redirecionar"
  | "pedir_esclarecimento"
  | "encerrar_resolvida";

export interface DraftExpectation {
  kind?: Draft["kind"];
  type?: "INC" | "REQ";
  category?: string;
  priority?: string;
  affected?: string;
  targetTicket?: string;
  descriptionIncludes?: string;
  hasAssumptions?: boolean;
  /** O rascunho anterior foi substituído neste turno ("refez o rascunho"). */
  replacedPrevious?: boolean;
}

export interface Expectation {
  action?: EvalAction | EvalAction[];
  draft?: DraftExpectation;
  /** Nenhum rascunho novo neste turno. */
  noDraft?: boolean;
  /** Nenhum chamado gravado no serviço de chamados (SC-002: só depois de Confirmar). */
  noTicketCreated?: boolean;
  ticketsCreated?: number;
  /** false = conversa continua com o agent; motivo(s) = transferida ou agendada por esse motivo. */
  transfer?: false | TransferReason | TransferReason[];
  pendingTransfer?: boolean;
  closed?: boolean;
  articleTitle?: string;
  optionsInclude?: string[];
  ticketListCount?: number;
  ticketCard?: { number: string; overdue?: boolean };
  noTicketCard?: boolean;
  noTicketList?: boolean;
  textIncludesAny?: string[];
  textExcludes?: string[];
  toolsCalled?: string[];
  minConfidence?: number;
  /** Regra livre (ex.: "nunca propor chamado com confiança < 60"). Devolve a falha ou null. */
  custom?: (observation: TurnObservation) => string | null;
}

export type TurnInput = { user: string } | { confirmDraft: true } | { cancelDraft: true };

export interface Turn {
  input: TurnInput;
  expect: Expectation;
}

export interface Scenario {
  id: string;
  title: string;
  /** História (us2…us7) e categorias do SC-001 para filtros e relatório. */
  tags: string[];
  category: string;
  employeeEmail: string;
  /** Situação inicial além do seed (chamados extras, rascunho pendente…). */
  setup?: (ctx: AppContext, helpers: SetupHelpers) => Promise<void>;
  turns: Turn[];
}

export interface SetupHelpers {
  now: Date;
  employeeId: string;
  /** Abre a conversa do funcionário (para fixtures que precisam dela). */
  conversation: () => Promise<Conversation>;
}

export interface TurnObservation {
  agentMessages: Message[];
  decision: Decision | null;
  text: string;
  toolsCalled: string[];
  articleTitles: string[];
  conversation: Conversation;
  newDraft: Draft | null;
  pendingDraft: Draft | null;
  replacedDraft: Draft | null;
  ticketsCreated: number;
  durationMs: number;
  error: string | null;
}

export interface TurnResult {
  turn: number;
  input: string;
  failures: string[];
  observation: Omit<TurnObservation, "conversation" | "agentMessages"> & { state: Conversation["state"] };
}

export interface ScenarioResult {
  id: string;
  title: string;
  category: string;
  tags: string[];
  passed: boolean;
  skipped?: string;
  turns: TurnResult[];
}
