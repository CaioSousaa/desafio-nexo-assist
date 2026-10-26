"use client";

import { LogOut, MessageSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { NexoMark } from "@/components/ui/NexoMark";
import { api } from "@/lib/api";

export function EmployeeSidebar({ user, active }: { user: { name: string; email: string }; active: "chat" | "perfil" }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await api.post("/api/auth/logout").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const item = (href: string, label: string, isActive: boolean, icon: React.ReactNode) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex h-9 items-center gap-[10px] rounded-[8px] px-[10px] text-[13.5px] ${isActive ? "bg-primary-soft font-semibold text-primary-text" : "font-medium text-ink-2 hover:bg-desk"}`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-rule px-[14px] pb-[14px] pt-5">
      <div className="flex items-center gap-[10px] px-2">
        <NexoMark size={20} />
        <span className="text-[16px] font-bold tracking-[-0.2px] text-ink">Nexo Assist</span>
      </div>
      <nav className="mt-[22px] flex flex-col gap-[2px]">
        {item("/chat", "Atendimento", active === "chat", <MessageSquare size={16} />)}
        {item("/perfil", "Meu perfil", active === "perfil", <UserRound size={16} />)}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-[10px] border-t border-rule px-2 pb-1 pt-[14px]">
        <Avatar name={user.name} tone="primary" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[11.5px] text-ink-3">{user.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={leaving}
        className="mt-1 flex h-[34px] items-center gap-[10px] rounded-[8px] px-[10px] text-[13.5px] font-medium text-ink-2 hover:bg-desk disabled:opacity-60"
      >
        <LogOut size={16} />
        Sair
      </button>
    </aside>
  );
}
