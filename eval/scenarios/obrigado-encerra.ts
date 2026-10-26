import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "obrigado-encerra",
  title: '"Resolveu, obrigado" encerra como resolvida pelo agent (US2.5)',
  tags: ["us2"],
  category: "encerramento",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    { input: { user: "qual o horário do service desk?" }, expect: { action: "responder_central", closed: false } },
    { input: { user: "resolveu, obrigado!" }, expect: { action: "encerrar_resolvida", closed: true, transfer: false } },
  ],
};
