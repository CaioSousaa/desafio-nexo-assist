import { describe, expect, it } from "vitest";
import { consoleListQuery, loginInput, messageInput } from "./schemas";

const id = "6f1c1f4e-8a52-4a8e-9a43-1f0c5d0b2a11";

describe("messageInput", () => {
  it("aceita de 1 a 2.000 caracteres com clientMessageId uuid", () => {
    expect(messageInput.parse({ text: "oi", clientMessageId: id }).text).toBe("oi");
    expect(messageInput.parse({ text: "x".repeat(2000), clientMessageId: id }).text).toHaveLength(2000);
  });

  it("remove espaços nas pontas antes de validar", () => {
    expect(messageInput.parse({ text: "  oi  ", clientMessageId: id }).text).toBe("oi");
    expect(messageInput.safeParse({ text: "   ", clientMessageId: id }).success).toBe(false);
  });

  it("rejeita vazio, 2.001 caracteres e sem id", () => {
    expect(messageInput.safeParse({ text: "", clientMessageId: id }).success).toBe(false);
    const tooLong = messageInput.safeParse({ text: "x".repeat(2001), clientMessageId: id });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe("Máximo de 2.000 caracteres.");
    expect(messageInput.safeParse({ text: "oi" }).success).toBe(false);
    expect(messageInput.safeParse({ text: "oi", clientMessageId: "abc" }).success).toBe(false);
  });
});

describe("loginInput", () => {
  it("exige e-mail válido e senha não vazia; remember padrão false", () => {
    expect(loginInput.parse({ email: "Ana.Souza@nexo.com.br", password: "x" })).toEqual({
      email: "ana.souza@nexo.com.br",
      password: "x",
      remember: false,
    });
    expect(loginInput.safeParse({ email: "ana", password: "x" }).success).toBe(false);
    expect(loginInput.safeParse({ email: "ana.souza@nexo.com.br", password: "" }).success).toBe(false);
  });
});

describe("consoleListQuery", () => {
  it("aceita os quatro filtros e q opcional", () => {
    for (const filter of ["todas", "para_voce", "com_agent", "minhas"]) {
      expect(consoleListQuery.parse({ filter }).filter).toBe(filter);
    }
    expect(consoleListQuery.parse({})).toEqual({ filter: "todas", q: undefined });
    expect(consoleListQuery.parse({ q: "  bruno " }).q).toBe("bruno");
    expect(consoleListQuery.parse({ q: "" }).q).toBeUndefined();
  });

  it("rejeita filtro desconhecido", () => {
    expect(consoleListQuery.safeParse({ filter: "outros" }).success).toBe(false);
  });
});
