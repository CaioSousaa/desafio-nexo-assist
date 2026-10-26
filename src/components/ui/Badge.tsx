import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "neutral" | "violet" | "primary" | "muted";

const dot: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-ink/40",
  violet: "bg-violet",
  primary: "bg-primary",
  muted: "bg-ink/25",
};

const text: Record<Tone, string> = {
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
  neutral: "text-ink-3",
  violet: "text-violet-text",
  primary: "text-primary-text",
  muted: "text-ink-3",
};

const pill: Record<Tone, string> = {
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  neutral: "bg-desk",
  violet: "bg-violet-soft",
  primary: "bg-primary-soft",
  muted: "bg-desk",
};

/** Ponto colorido + rótulo (status de chamado, prioridade, estado). `pill` adiciona fundo suave. */
export function Badge({ tone, children, pill: asPill = false, showDot = true, className = "" }: { tone: Tone; children: ReactNode; pill?: boolean; showDot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[6px] text-[12.5px] font-medium ${text[tone]} ${asPill ? `rounded-full px-[10px] py-[5px] ${pill[tone]}` : ""} ${className}`}>
      {showDot && <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${dot[tone]}`} />}
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "aguardando_analista":
      return "warning";
    case "em_andamento":
    case "em_atendimento":
      return "primary";
    case "aprovado":
    case "resolvido":
      return "success";
    default:
      return "neutral";
  }
}

export function priorityTone(priority: string): Tone {
  switch (priority) {
    case "Crítica":
      return "danger";
    case "Alta":
      return "warning";
    case "Média":
      return "neutral";
    default:
      return "muted";
  }
}
