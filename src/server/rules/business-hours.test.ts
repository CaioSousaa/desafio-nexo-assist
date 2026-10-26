import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addBusinessHours,
  businessHoursBetween,
  isBusinessTime,
  nextBusinessMoment,
} from "./business-hours";

// São Paulo = UTC-3 (sem horário de verão desde 2019). Entradas em UTC.
const sp = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

describe("horas úteis (seg–sex, 08:00–18:00, America/Sao_Paulo)", () => {
  it("sexta 17:00 + 4 h úteis = segunda 11:00", () => {
    expect(addBusinessHours(sp("2026-10-23T17:00:00"), 4)).toEqual(sp("2026-10-26T11:00:00"));
  });

  it("sábado cai na próxima segunda 08:00", () => {
    expect(nextBusinessMoment(sp("2026-10-24T10:00:00"))).toEqual(sp("2026-10-26T08:00:00"));
    expect(addBusinessHours(sp("2026-10-24T10:00:00"), 4)).toEqual(sp("2026-10-26T12:00:00"));
  });

  it("18:00 passa para 08:00 do dia útil seguinte", () => {
    expect(nextBusinessMoment(sp("2026-10-27T18:00:00"))).toEqual(sp("2026-10-28T08:00:00"));
    expect(addBusinessHours(sp("2026-10-27T18:00:00"), 1)).toEqual(sp("2026-10-28T09:00:00"));
  });

  it("antes das 08:00 começa a contar às 08:00", () => {
    expect(addBusinessHours(sp("2026-10-27T06:30:00"), 2)).toEqual(sp("2026-10-27T10:00:00"));
  });

  it("dentro do expediente soma direto", () => {
    expect(addBusinessHours(sp("2026-10-26T09:43:00"), 4)).toEqual(sp("2026-10-26T13:43:00"));
  });

  it("termina exatamente no fechamento sem pular de dia", () => {
    expect(addBusinessHours(sp("2026-10-26T14:00:00"), 4)).toEqual(sp("2026-10-26T18:00:00"));
  });

  it("dias úteis mantêm o horário e pulam o fim de semana", () => {
    expect(addBusinessDays(sp("2026-10-26T10:00:00"), 3)).toEqual(sp("2026-10-29T10:00:00"));
    expect(addBusinessDays(sp("2026-10-23T10:00:00"), 3)).toEqual(sp("2026-10-28T10:00:00"));
    expect(addBusinessDays(sp("2026-10-23T10:00:00"), 5)).toEqual(sp("2026-10-30T10:00:00"));
  });

  it("aceita entrada em UTC e responde no fuso de São Paulo", () => {
    // 2026-10-23T20:00Z = sexta 17:00 em São Paulo
    expect(addBusinessHours(new Date("2026-10-23T20:00:00Z"), 4).toISOString()).toBe(
      "2026-10-26T14:00:00.000Z",
    );
  });

  it("isBusinessTime respeita expediente e fim de semana", () => {
    expect(isBusinessTime(sp("2026-10-26T08:00:00"))).toBe(true);
    expect(isBusinessTime(sp("2026-10-26T17:59:00"))).toBe(true);
    expect(isBusinessTime(sp("2026-10-26T18:00:00"))).toBe(false);
    expect(isBusinessTime(sp("2026-10-25T12:00:00"))).toBe(false);
  });

  it("businessHoursBetween conta só o expediente", () => {
    expect(businessHoursBetween(sp("2026-10-23T17:00:00"), sp("2026-10-26T09:00:00"))).toBe(2);
    expect(businessHoursBetween(sp("2026-10-26T10:00:00"), sp("2026-10-26T10:00:00"))).toBe(0);
    expect(businessHoursBetween(sp("2026-10-26T12:00:00"), sp("2026-10-26T10:00:00"))).toBe(0);
  });
});
