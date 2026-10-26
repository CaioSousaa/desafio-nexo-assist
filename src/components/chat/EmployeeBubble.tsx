import { formatTime } from "@/lib/format";

export function EmployeeBubble({ text, createdAt, variant, pending = false }: { text: string; createdAt: string; variant: "chat" | "console"; pending?: boolean }) {
  if (variant === "console") {
    return (
      <div className="flex w-full flex-col items-start pt-4">
        <div className="flex max-w-[78%] items-end gap-[10px] rounded-[4px_12px_12px_12px] bg-paper px-3 pb-[6px] pt-2 shadow-[0_1px_1px_#1B24310D]">
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[21px] text-ink">{text}</p>
          <time className="shrink-0 pb-[1px] text-[11px] text-ink-3">{formatTime(createdAt)}</time>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full justify-end">
      <div className={`max-w-[520px] rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px] leading-[21px] text-white ${pending ? "opacity-70" : ""}`}>
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}
