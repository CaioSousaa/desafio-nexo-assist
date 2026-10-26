import { describe, expect, it } from "vitest";
import { ARTICLES } from "./articles";
import { normalize, searchHelpCenter } from "./search";

describe("central de ajuda", () => {
  it("tem de 5 a 10 artigos, incluindo os dois do Anexo B com o texto literal", () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(5);
    expect(ARTICLES.length).toBeLessThanOrEqual(10);
    expect(ARTICLES.map((a) => a.body)).toEqual(
      expect.arrayContaining([
        "VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
        "Horário do service desk: de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
      ]),
    );
  });

  it('"até que horas o suporte atende?" encontra "Horário do service desk" em 1º', () => {
    const hits = searchHelpCenter("até que horas o suporte atende?");
    expect(hits[0]?.id).toBe("horario-service-desk");
  });

  it('"qual o horário do service desk?" também', () => {
    expect(searchHelpCenter("qual o horário do service desk?")[0]?.title).toBe("Horário do service desk");
  });

  it('"erro 809" traz o artigo da VPN; não se aplica a Windows 11 e se aplica a Windows 10', () => {
    const win11 = searchHelpCenter("Meu notebook não conecta na VPN desde ontem. Erro 809.", { deviceOs: "Windows 11" });
    const vpn809 = win11.find((h) => h.id === "vpn-erro-809");
    expect(win11[0]?.id).toBe("vpn-erro-809");
    expect(vpn809?.appliesToEmployee).toBe(false);
    expect(vpn809?.conditions).toEqual({ os: ["Windows 10"] });

    const win10 = searchHelpCenter("erro 809", { deviceOs: "Windows 10" });
    expect(win10.find((h) => h.id === "vpn-erro-809")?.appliesToEmployee).toBe(true);
  });

  it("busca sem acento encontra artigo com acento", () => {
    expect(searchHelpCenter("vpn nao conecta").map((h) => h.id)).toContain("vpn-nao-conecta");
    expect(searchHelpCenter("HORARIO").map((h) => h.id)).toContain("horario-service-desk");
  });

  it("devolve no máximo 3 resultados", () => {
    expect(searchHelpCenter("vpn senha wifi impressora e-mail software horário").length).toBeLessThanOrEqual(3);
  });

  it("consulta sem correspondência (assunto fora de TI) volta vazia", () => {
    expect(searchHelpCenter("como peço férias?")).toEqual([]);
    expect(searchHelpCenter("reembolso de táxi")).toEqual([]);
    expect(searchHelpCenter("")).toEqual([]);
  });

  it("artigo sem condição se aplica a qualquer dispositivo", () => {
    expect(searchHelpCenter("impressora", { deviceOs: "macOS 15" })[0]?.appliesToEmployee).toBe(true);
  });

  it("normalize remove acentos, caixa e pontuação", () => {
    expect(normalize("Não CONECTA, Wi-Fi!")).toBe("nao conecta wifi");
  });
});
