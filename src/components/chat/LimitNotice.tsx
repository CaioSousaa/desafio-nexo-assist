"use client";

import { Button } from "@/components/ui/Button";

export function LimitNotice({ onContinue, onTransfer, busy, disabled }: { onContinue: () => void; onTransfer: () => void; busy: string | null; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={onContinue} loading={busy === "continue"} disabled={disabled || busy !== null}>
        Continuar em nova conversa
      </Button>
      <Button variant="secondary" onClick={onTransfer} loading={busy === "transfer"} disabled={disabled || busy !== null}>
        Falar com um analista
      </Button>
    </div>
  );
}
