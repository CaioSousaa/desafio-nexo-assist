import { TRANSFER_REASON_LABELS } from "@/lib/labels";
import { formatTime } from "@/lib/format";
import type { ConsoleConversationSnapshot } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 text-[13.5px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/** Resumo da transferência no topo da conversa (FR-061) e resumo herdado de conversa continuada (US11.7). */
export function TransferSummary({ snapshot }: { snapshot: ConsoleConversationSnapshot }) {
  const { transfer, conversation } = snapshot;
  const blocks: React.ReactNode[] = [];
  if (transfer.summary && conversation.state !== "com_agent") {
    const summary = transfer.summary;
    blocks.push(
      <section key="transfer" className="rounded-[12px] bg-paper p-4 shadow-[0_1px_2px_#1B24310D] outline outline-1 -outline-offset-1 outline-warning/30">
        <h3 className="mb-3 flex items-center justify-between text-[12.5px] font-semibold uppercase tracking-[0.4px] text-warning-text">
          Resumo da transferência
          {transfer.transferredAt && <span className="font-medium normal-case tracking-normal text-ink-3">às {formatTime(transfer.transferredAt)}</span>}
        </h3>
        <dl className="flex flex-col gap-2">
          <Row label="Motivo">
            {transfer.reason ? TRANSFER_REASON_LABELS[transfer.reason] : "—"}
            {summary.notConfirmed ? " · funcionário não confirmou o chamado" : ""}
          </Row>
          {transfer.confidence !== null && <Row label="Confiança">{transfer.confidence}%</Row>}
          <Row label="Problema">{summary.problem}</Row>
          <Row label="O que o agent já fez">{summary.done || "—"}</Row>
          <Row label="Chamados">{summary.tickets.length ? summary.tickets.join(", ") : "nenhum"}</Row>
          {summary.priority && <Row label="Prioridade">{summary.priority}</Row>}
        </dl>
      </section>,
    );
  }
  if (conversation.inheritedSummary) {
    blocks.push(
      <section key="inherited" className="rounded-[12px] bg-paper p-4 text-[13.5px] text-ink-2 outline outline-1 -outline-offset-1 outline-rule">
        <h3 className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-ink-3">Resumo herdado da conversa anterior</h3>
        <p>{conversation.inheritedSummary}</p>
      </section>,
    );
  }
  return blocks.length ? <div className="flex flex-col gap-3 pb-2">{blocks}</div> : null;
}
