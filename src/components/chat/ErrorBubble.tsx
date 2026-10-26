"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorBubble({ text, onRetry, disabled }: { text: string; onRetry?: () => void; disabled?: boolean }) {
  return (
    <div role="alert" className="flex w-fit max-w-[600px] items-center gap-3 rounded-[4px_12px_12px_12px] bg-danger-soft px-4 py-3 text-[14.5px] text-danger-text outline outline-1 -outline-offset-1 outline-danger/20">
      <span>{text}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} disabled={disabled} icon={<RotateCcw size={14} />}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
