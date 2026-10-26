"use client";

import { Button } from "@/components/ui/Button";

export interface DraftActionHandlers {
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  confirming: boolean;
  cancelling: boolean;
}

export function DraftActions({ onConfirm, onEdit, onCancel, confirming, cancelling }: DraftActionHandlers) {
  const busy = confirming || cancelling;
  const mac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  return (
    <div className="flex items-center gap-[6px] border-t border-rule bg-desk py-2 pl-2 pr-[14px]">
      <Button variant="primary" onClick={onConfirm} loading={confirming} disabled={busy} className="pl-[14px] pr-[10px]">
        Confirmar
        <kbd className="rounded-[6px] bg-white/15 px-[5px] py-[1px] font-ui text-[11.5px] text-white/80">{mac ? "⌘↵" : "Ctrl+↵"}</kbd>
      </Button>
      <Button variant="secondary" onClick={onEdit} disabled={busy}>
        Editar
      </Button>
      <Button variant="ghost" onClick={onCancel} loading={cancelling} disabled={busy}>
        Cancelar
      </Button>
    </div>
  );
}
