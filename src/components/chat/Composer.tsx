"use client";

import { ArrowUp, Lock } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "@/server/http/schemas.constants";

export interface ComposerProps {
  placeholder: string;
  onSubmit: (text: string) => Promise<boolean> | boolean | void;
  disabled?: boolean;
  /** Campo bloqueado com aviso (limite, assumir para responder…). */
  lockedText?: string | null;
  counter?: { used: number; limit: number } | null;
  /** Muda a cada clique em "Editar": foca o campo com a dica. */
  focusSignal?: number;
  hint?: string | null;
  variant?: "chat" | "console";
  busyText?: string | null;
}

/** Campo de mensagem com limite de 2.000 caracteres (FR-010) e contador N/30 (FR-070). */
export function Composer({ placeholder, onSubmit, disabled = false, lockedText, counter, focusSignal = 0, hint, variant = "chat", busyText }: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const blocked = Boolean(lockedText) || disabled;

  useEffect(() => {
    if (focusSignal > 0) ref.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function submit() {
    const value = text.trim();
    if (!value || tooLong || blocked || sending) return;
    setSending(true);
    const ok = await onSubmit(value);
    setSending(false);
    if (ok !== false) setText("");
    ref.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  if (lockedText) {
    return (
      <div className={`flex h-[44px] items-center gap-3 rounded-[12px] px-[14px] text-[14.5px] text-ink-3 ${variant === "chat" ? "bg-desk" : "bg-desk opacity-80"}`} role="status">
        <Lock size={15} />
        {lockedText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[6px]">
      <div className={`flex min-h-[48px] items-end gap-2 rounded-[12px] bg-paper py-[6px] pl-4 pr-[6px] outline outline-1 -outline-offset-1 focus-within:outline-2 focus-within:outline-primary ${tooLong ? "outline-danger" : "outline-ink/15"}`}>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={hint ?? placeholder}
          aria-label={hint ?? placeholder}
          aria-invalid={tooLong}
          disabled={disabled}
          className="max-h-[140px] flex-1 resize-none self-center bg-transparent py-[6px] text-[14.5px] leading-[21px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!text.trim() || tooLong || sending || disabled}
          className="flex h-9 shrink-0 items-center gap-[6px] rounded-[6px] bg-cta px-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0057ae] disabled:opacity-50"
        >
          Enviar
          <ArrowUp size={15} />
        </button>
      </div>
      <div className="flex justify-between gap-4 text-[12.5px] text-ink-3">
        <span role={tooLong ? "alert" : undefined} className={tooLong ? "text-danger-text" : ""}>
          {tooLong ? `Máximo de 2.000 caracteres (${text.length}/2.000).` : (busyText ?? "")}
        </span>
        {counter && (
          <span>
            {counter.used}/{counter.limit} mensagens nesta sessão
          </span>
        )}
      </div>
    </div>
  );
}
