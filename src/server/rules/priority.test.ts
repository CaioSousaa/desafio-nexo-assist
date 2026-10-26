import { describe, expect, it } from "vitest";
import { classifyPriority, type PriorityInput } from "./priority";

const base: PriorityInput = {
  kind: "INC",
  impact: "somente_voce",
  blocksWork: false,
  sameDayCommitment: false,
  hasWorkaround: false,
};

describe("classifyPriority (tabela do Anexo A)", () => {
  it.each([
    ["equipe", "Crítica"],
    ["empresa", "Crítica"],
  ] as const)("INC com impacto %s e trabalho parado é %s", (impact, expected) => {
    const result = classifyPriority({ ...base, impact, blocksWork: true });
    expect(result.priority).toBe(expected);
    expect(result.rule).toMatch(/1 hora corrida/);
  });

  it("INC que afeta uma equipe sem parar o trabalho é Alta", () => {
    expect(classifyPriority({ ...base, impact: "equipe", hasWorkaround: true }).priority).toBe("Alta");
  });

  it("INC só meu com compromisso no mesmo dia é Alta (cenário VPN + reunião às 14h)", () => {
    const result = classifyPriority({ ...base, sameDayCommitment: true });
    expect(result.priority).toBe("Alta");
    expect(result.rule).toMatch(/compromisso no mesmo dia/);
  });

  it("INC só meu que impede o trabalho sem alternativa é Alta", () => {
    expect(classifyPriority({ ...base, blocksWork: true }).priority).toBe("Alta");
  });

  it("INC só meu com alternativa é Média", () => {
    expect(classifyPriority({ ...base, blocksWork: true, hasWorkaround: true }).priority).toBe("Média");
  });

  it("INC sem urgência declarada é Média", () => {
    const result = classifyPriority(base);
    expect(result.priority).toBe("Média");
    expect(result.rule).toMatch(/sem urgência/);
  });

  it("REQ sem urgência é Baixa", () => {
    expect(classifyPriority({ ...base, kind: "REQ" }).priority).toBe("Baixa");
  });

  it("REQ com urgência é Média e nunca Crítica", () => {
    expect(classifyPriority({ ...base, kind: "REQ", sameDayCommitment: true }).priority).toBe("Média");
    expect(classifyPriority({ ...base, kind: "REQ", impact: "empresa", blocksWork: true }).priority).toBe("Alta");
  });

  it('impacto desconhecido ("Não sei") é tratado como "só você" e vira premissa', () => {
    const unknown = classifyPriority({ ...base, impact: "desconhecido", blocksWork: true });
    const onlyMe = classifyPriority({ ...base, impact: "somente_voce", blocksWork: true });
    expect(unknown.priority).toBe(onlyMe.priority);
    expect(unknown.assumptions).toHaveLength(1);
    expect(unknown.assumptions[0]).toMatch(/só você/);
    expect(onlyMe.assumptions).toEqual([]);
  });
});
