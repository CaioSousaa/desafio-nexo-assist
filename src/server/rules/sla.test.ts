import { describe, expect, it } from "vitest";
import { deadlineFor, isOverdue, slaInfo } from "./sla";

const sp = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

describe("prazo por prioridade", () => {
  const from = sp("2026-10-23T17:00:00"); // sexta

  it("Crítica: 1 hora corrida, mesmo fora do expediente", () => {
    expect(deadlineFor("Crítica", from)).toEqual(sp("2026-10-23T18:00:00"));
    expect(deadlineFor("Crítica", sp("2026-10-24T23:30:00"))).toEqual(sp("2026-10-25T00:30:00"));
  });

  it("Alta: 4 horas úteis", () => {
    expect(deadlineFor("Alta", from)).toEqual(sp("2026-10-26T11:00:00"));
  });

  it("Média: 3 dias úteis", () => {
    expect(deadlineFor("Média", from)).toEqual(sp("2026-10-28T17:00:00"));
  });

  it("Baixa: 5 dias úteis", () => {
    expect(deadlineFor("Baixa", from)).toEqual(sp("2026-10-30T17:00:00"));
  });
});

describe("vencido", () => {
  const updatedAt = sp("2026-10-26T10:00:00");
  const deadline = sp("2026-10-26T14:00:00"); // Alta

  it("no limite exato ainda está no prazo; 1 ms depois está vencido", () => {
    const ticket = { status: "aberto", priority: "Alta", updatedAt } as const;
    expect(isOverdue(ticket, deadline)).toBe(false);
    expect(isOverdue(ticket, new Date(deadline.getTime() + 1))).toBe(true);
  });

  it("chamado resolvido nunca vence", () => {
    expect(isOverdue({ status: "resolvido", priority: "Alta", updatedAt }, sp("2026-11-30T10:00:00"))).toBe(false);
  });

  it("vale para qualquer status aberto (aguardando analista, aprovado…)", () => {
    const now = sp("2026-11-30T10:00:00");
    for (const status of ["aberto", "em_andamento", "aguardando_analista", "em_atendimento", "aprovado"] as const) {
      expect(isOverdue({ status, priority: "Baixa", updatedAt }, now)).toBe(true);
    }
  });

  it("slaInfo descreve o atraso para o funcionário e para o console (mesmo cálculo)", () => {
    // Média atualizada terça 14:20 vence sexta 14:20; segunda está vencido.
    const ticket = { status: "aguardando_analista", priority: "Média", updatedAt: sp("2026-10-20T14:20:00") } as const;
    const now = sp("2026-10-26T14:20:00");
    const info = slaInfo(ticket, now);
    expect(info.overdue).toBe(true);
    expect(info.deadlineAt).toBe(sp("2026-10-23T14:20:00").toISOString());
    expect(info.lastUpdateText).toBe("há 6 dias");
    expect(info.ruleText).toBe("Média: 3 dias úteis");
    expect(info.overdueByText).toBe("venceu há 3 dias");
    expect(isOverdue(ticket, now)).toBe(info.overdue);
  });

  it("slaInfo de chamado no prazo não traz texto de atraso", () => {
    const info = slaInfo({ status: "aberto", priority: "Baixa", updatedAt: sp("2026-10-26T09:00:00") }, sp("2026-10-26T10:00:00"));
    expect(info.overdue).toBe(false);
    expect(info.overdueByText).toBeNull();
    expect(info.lastUpdateText).toBe("há 1 h");
  });
});
