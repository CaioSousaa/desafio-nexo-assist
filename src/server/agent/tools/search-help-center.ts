import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchHelpCenter } from "../../help-center/search";
import { requireTurn } from "./context";

export const searchHelpCenterTool = createTool({
  id: "search_help_center",
  description:
    "Busca artigos na central de ajuda de TI. Cada artigo traz conditions e appliesToEmployee (o servidor compara com o dispositivo do funcionário): só recomende artigo com appliesToEmployee=true.",
  inputSchema: z.object({ query: z.string().min(1).describe("Termos da dúvida ou do problema") }),
  execute: async ({ query }, context) => {
    const { employee } = requireTurn(context);
    const articles = searchHelpCenter(query, { deviceOs: employee.deviceOs });
    return {
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        conditions: a.conditions,
        appliesToEmployee: a.appliesToEmployee,
      })),
      employeeDevice: `${employee.deviceModel ?? "?"} · ${employee.deviceOs ?? "?"}`,
    };
  },
});
