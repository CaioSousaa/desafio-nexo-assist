import { rmSync } from "node:fs";
import { resolve } from "node:path";

// Recarrega os dados de exemplo (FR-105): apaga os bancos locais, aplica as migrations e semeia.
//   npm run db:reset                 apaga app.db e tickets.db
//   npm run db:reset -- --keep-tickets   mantém o banco do serviço de chamados

try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: caminhos padrão
}

async function main() {
  const { createAppContext } = await import("@/server/context");
  const { seed } = await import("@/server/seed/run");
  const { listUsers } = await import("@/server/auth/users");
  const { listAllConversations } = await import("@/server/conversations/repo");
  const { deterministicSummarizer } = await import("@/server/agent/summarize");

  process.env.LOG_LEVEL ??= "warn";
  const appPath = resolve(process.env.APP_DB_PATH || "./data/app.db");
  const ticketsPath = resolve(process.env.TICKETS_DB_PATH || "./data/tickets.db");
  const keepTickets = process.argv.includes("--keep-tickets");
  const remove = (path: string) => {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
  };
  remove(appPath);
  if (!keepTickets) remove(ticketsPath);

  // O modelo não é chamado aqui; o contexto só precisa de uma configuração válida.
  const ctx = await createAppContext({
    appDbPath: appPath,
    ticketsDbPath: ticketsPath,
    model: { id: "google/gemini-3.5-flash-lite", apiKey: "nao-usada" },
    modelName: "gemini-3.5-flash-lite",
    summarizer: deterministicSummarizer,
  });
  try {
    const report = await seed({ db: ctx.db, tickets: ctx.ticketsLocal, now: new Date() });
    const users = await listUsers(ctx.db);
    const conversations = await listAllConversations(ctx.db);
    console.log(`Dados de exemplo recarregados${keepTickets ? " (chamados mantidos)" : ""}:`);
    console.log(`  ${users.length} usuários (${users.filter((u) => u.role === "analista").length} analistas)`);
    console.log(`  ${await ctx.ticketsLocal.count()} chamados (${report.tickets} novos)`);
    console.log(`  ${conversations.length} conversas prontas`);
    console.log(`  bancos: ${appPath} · ${ticketsPath}`);
  } finally {
    ctx.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
