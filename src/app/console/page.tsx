import { ConsoleScreen } from "@/components/console/ConsoleScreen";
import { listForConsole } from "@/server/conversations/console-list";
import { pageUser } from "@/server/http/page-user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Console · Nexo Assist" };

export default async function ConsolePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { ctx, user } = await pageUser("analista");
  const [list, params] = await Promise.all([listForConsole(ctx, user.id, { filter: "todas" }), searchParams]);
  return <ConsoleScreen analyst={{ id: user.id, name: user.name }} initialList={list} initialSelected={params.c ?? null} />;
}
