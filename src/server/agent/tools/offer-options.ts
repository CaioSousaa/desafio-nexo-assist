import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";

export const offerOptionsTool = createTool({
  id: "offer_options",
  description: "Mostra de 1 a 4 opções rápidas clicáveis abaixo da resposta (o clique vira mensagem do funcionário).",
  inputSchema: z.object({ options: z.array(z.string().min(1).max(60)).min(1).max(4) }),
  execute: async ({ options }, context) => {
    const { scratch } = requireTurn(context);
    scratch.quickOptions = options;
    return { shown: options.length };
  },
});
