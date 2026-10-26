import { classifyPriorityTool } from "./classify-priority";
import { closeAsResolvedTool } from "./close-as-resolved";
import { getTicketTool } from "./get-ticket";
import { listMyTicketsTool } from "./list-my-tickets";
import { offerOptionsTool } from "./offer-options";
import { offerTicketSelectionTool } from "./offer-ticket-selection";
import { proposeDraftTool } from "./propose-draft";
import { recordDecisionTool } from "./record-decision";
import { redirectOutOfScopeTool } from "./redirect-out-of-scope";
import { requestTransferTool } from "./request-transfer";
import { searchHelpCenterTool } from "./search-help-center";
import { showTicketCardTool } from "./show-ticket-card";

/** Registro das ferramentas por nome (o nome é o que o modelo chama e o que aparece em "Ferramentas"). */
export const nexoTools = {
  list_my_tickets: listMyTicketsTool,
  get_ticket: getTicketTool,
  search_help_center: searchHelpCenterTool,
  classify_priority: classifyPriorityTool,
  propose_draft: proposeDraftTool,
  offer_options: offerOptionsTool,
  offer_ticket_selection: offerTicketSelectionTool,
  show_ticket_card: showTicketCardTool,
  request_transfer: requestTransferTool,
  redirect_out_of_scope: redirectOutOfScopeTool,
  close_as_resolved: closeAsResolvedTool,
  record_decision: recordDecisionTool,
};
export type NexoToolName = keyof typeof nexoTools;
