import { ProfilePage } from "@/components/chat/ProfilePage";
import { pageUser } from "@/server/http/page-user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu perfil · Nexo Assist" };

export default async function PerfilPage() {
  const { user } = await pageUser("funcionario");
  return <ProfilePage user={{ name: user.name, email: user.email, passwordChangedAt: user.passwordChangedAt }} />;
}
