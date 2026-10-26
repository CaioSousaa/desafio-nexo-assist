import { ChatScreen } from "@/components/chat/ChatScreen";
import { chatSnapshot } from "@/server/conversations/snapshot";
import { pageUser } from "@/server/http/page-user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Atendimento · Nexo Assist" };

export default async function ChatPage() {
  const { ctx, user } = await pageUser("funcionario");
  const snapshot = await chatSnapshot(ctx, user);
  return <ChatScreen user={{ name: user.name, email: user.email }} initial={snapshot} />;
}
