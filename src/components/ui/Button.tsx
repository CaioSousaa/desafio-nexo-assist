import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-cta text-white font-semibold hover:bg-[#0057ae] disabled:bg-cta/60",
  secondary: "bg-paper text-ink font-medium outline outline-1 -outline-offset-1 outline-rule hover:bg-desk",
  ghost: "bg-transparent text-ink-2 font-medium hover:bg-desk",
  danger: "bg-danger-soft text-danger-text font-medium hover:bg-danger/15",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  size?: "md" | "lg";
}

export function Button({ variant = "secondary", loading = false, icon, size = "md", className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-[7px] rounded-[8px] px-[14px] text-[13.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${size === "lg" ? "h-[44px] text-[15.5px]" : "h-[36px]"} ${styles[variant]} ${className}`}
    >
      {loading ? <Spinner size={13} /> : icon}
      {children}
    </button>
  );
}
