import { z } from "zod";
import { AFFECTED, CATEGORIES, PRIORITIES, TICKET_KINDS, TICKET_STATUSES } from "../rules/catalog";

export const ticketSchema = z.object({
  number: z.string(),
  kind: z.enum(TICKET_KINDS),
  title: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  affected: z.enum(AFFECTED),
  requesterEmail: z.string(),
  status: z.enum(TICKET_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const TICKET_EVENT_KINDS = [
  "criado",
  "nota",
  "prioridade",
  "status",
  "reaberto",
  "transferido",
  "assumido",
] as const;
export type TicketEventKind = (typeof TICKET_EVENT_KINDS)[number];

export const ticketEventSchema = z.object({
  id: z.number(),
  ticketNumber: z.string(),
  kind: z.enum(TICKET_EVENT_KINDS),
  text: z.string(),
  author: z.string(),
  createdAt: z.string(),
});
export type TicketEvent = z.infer<typeof ticketEventSchema>;

export interface TicketWithEvents {
  ticket: Ticket;
  events: TicketEvent[];
}

export const createTicketInputSchema = z.object({
  kind: z.enum(TICKET_KINDS),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  affected: z.enum(AFFECTED),
  requesterEmail: z.string().email(),
});
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

/** Autor padrão das notas gravadas a partir do chat. */
export const VIA_NEXO_ASSIST = "via Nexo Assist";
