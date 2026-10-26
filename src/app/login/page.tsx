import { LoginForm } from "@/components/login/LoginForm";
import { LoginShowcase } from "@/components/login/LoginShowcase";

export const metadata = { title: "Entrar · Nexo Assist" };

export default function LoginPage() {
  return (
    <main className="flex h-full min-h-[640px] bg-paper">
      <LoginShowcase />
      <LoginForm />
    </main>
  );
}
