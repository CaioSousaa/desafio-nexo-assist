"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { daysSince } from "@/lib/format";
import { ChatTopBar } from "./ChatTopBar";
import { EmployeeSidebar } from "./EmployeeSidebar";

/** Meu perfil, somente leitura (FR-090, D7). */
export function ProfilePage({ user }: { user: { name: string; email: string; passwordChangedAt: string } }) {
  const toast = useToast();
  const days = daysSince(user.passwordChangedAt);
  return (
    <div className="flex h-full">
      <EmployeeSidebar user={user} active="perfil" />
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatTopBar here="Meu perfil" />
        <div className="flex flex-1 justify-center overflow-y-auto px-10 py-12">
          <div className="flex w-full max-w-[600px] flex-col gap-8">
            <div className="flex flex-col gap-[6px]">
              <h1 className="text-[24px] font-bold tracking-[-0.4px] text-ink">Meu perfil</h1>
              <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
            </div>

            <dl className="overflow-hidden rounded-[16px] bg-paper outline outline-1 -outline-offset-1 outline-ink/10">
              <div className="flex items-center gap-4 px-6 py-5">
                <dt className="w-40 shrink-0 text-[13.5px] text-ink-3">Nome</dt>
                <dd className="text-[14.5px] font-medium text-ink">{user.name}</dd>
              </div>
              <div className="flex items-center gap-4 border-t border-rule px-6 py-5">
                <dt className="w-40 shrink-0 text-[13.5px] text-ink-3">E-mail corporativo</dt>
                <dd className="flex-1 text-[14.5px] font-medium text-ink">{user.email}</dd>
                <dd className="flex items-center gap-[5px] text-[12.5px] text-ink-3">
                  <ShieldCheck size={14} />
                  Gerenciado pela TI
                </dd>
              </div>
            </dl>

            <section className="overflow-hidden rounded-[16px] bg-paper outline outline-1 -outline-offset-1 outline-ink/10">
              <div className="flex items-center gap-4 p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-desk text-ink-2">
                  <KeyRound size={18} />
                </span>
                <div className="flex flex-1 flex-col gap-[3px]">
                  <h2 className="text-[14.5px] font-semibold text-ink">Senha</h2>
                  <p className="text-[13.5px] text-ink-3">Alterada há {days} dias</p>
                </div>
                <Button variant="secondary" onClick={() => toast("Indisponível neste protótipo. Fale com a TI no ramal 4000.")}>
                  Redefinir senha
                </Button>
              </div>
              <p className="bg-desk px-6 py-3 text-[13px] text-ink-3">Enviaremos um link de redefinição para {user.email}.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
