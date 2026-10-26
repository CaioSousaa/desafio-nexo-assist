import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";

export const redirectOutOfScopeTool = createTool({
  id: "redirect_out_of_scope",
  description: "Registra que o assunto não é de TI e qual canal foi indicado (RH, Financeiro, Facilities). Não abre chamado nem transfere.",
  inputSchema: z.object({
    area: z.enum(["RH", "Financeiro", "Facilities", "Outro"]),
    channel: z.string().describe("Canal indicado ao funcionário"),
  }),
  execute: async ({ area, channel }, context) => {
    const { scratch } = requireTurn(context);
    scratch.redirect = { area, channel };
    return { redirected: true };
  },
});
