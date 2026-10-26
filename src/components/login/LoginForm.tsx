"use client";

import { Eye, EyeOff, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

const UNAVAILABLE = "Indisponível neste protótipo.";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError("Informe a senha.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password, remember });
      router.replace(user.role === "analista" ? "/console" : "/chat");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível entrar. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full flex-1 flex-col justify-between px-14 py-10">
      <div className="flex justify-end gap-[6px] text-[13.5px]">
        <span className="text-ink-3">Problema para entrar?</span>
        <button type="button" onClick={() => toast(UNAVAILABLE)} className="font-semibold text-primary-text hover:underline">
          Ligue no ramal 4000
        </button>
      </div>

      <div className="flex justify-center">
        <form onSubmit={submit} className="flex w-[380px] flex-col gap-7" noValidate>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[40px] leading-[44px] tracking-[-0.8px] text-ink">Entrar</h2>
            <p className="text-[15.5px] leading-[23px] text-ink-3">Use seu e-mail corporativo e a senha da rede Nexo.</p>
          </div>

          <div className="flex flex-col gap-[18px]">
            <label className="flex flex-col gap-2">
              <span className="text-[13.5px] font-medium text-ink">E-mail corporativo</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana.souza@nexo.com.br"
                aria-invalid={error !== null}
                aria-describedby={error ? "login-error" : undefined}
                className={`h-[44px] rounded-[8px] bg-paper px-[14px] text-[14.5px] text-ink outline outline-1 -outline-offset-1 placeholder:text-ink-3/70 focus:outline-2 focus:outline-primary ${error ? "outline-danger" : "outline-ink/15"}`}
              />
              {error && (
                <span id="login-error" role="alert" className="text-[13px] text-danger-text">
                  {error}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between">
                <span className="text-[13.5px] font-medium text-ink">Senha</span>
                <button type="button" onClick={() => toast(UNAVAILABLE)} className="text-[13.5px] font-medium text-primary-text hover:underline">
                  Esqueci minha senha
                </button>
              </span>
              <span className="flex h-[44px] items-center rounded-[8px] bg-paper pl-[14px] pr-2 outline outline-1 -outline-offset-1 outline-ink/15 focus-within:outline-2 focus-within:outline-primary">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-full flex-1 bg-transparent text-[14.5px] text-ink outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-ink-3 hover:bg-desk"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <label className="flex w-fit cursor-pointer items-center gap-[9px] pt-[2px]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[6px] bg-paper text-white outline outline-1 -outline-offset-1 outline-ink/25 peer-checked:bg-cta peer-checked:outline-cta peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                {remember && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="text-[13.5px] text-ink-2">Manter conectado neste computador</span>
            </label>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
            Entrar
          </Button>
        </form>
      </div>

      <footer className="flex justify-between text-[12.5px] text-ink-3">
        <span>© 2026 Nexo · Service desk de TI</span>
        <button type="button" onClick={() => toast(UNAVAILABLE)} className="hover:underline">
          Privacidade e uso de dados
        </button>
      </footer>
    </section>
  );
}
