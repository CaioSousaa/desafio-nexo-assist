import { formatTime } from "@/lib/format";
import { ANALYST_LEVEL_LABELS } from "@/lib/labels";

export function AnalystBubble({ text, createdAt, name, level, variant }: { text: string; createdAt: string; name: string; level: string | null; variant: "chat" | "console" }) {
  const tag = level ? (ANALYST_LEVEL_LABELS[level] ?? level) : "Service desk";
  const header = (
    <div className="flex items-center gap-[6px] px-1">
      <span className={`font-semibold ${variant === "console" ? "text-[12px] text-ink-2" : "text-[12.5px] text-ink"}`}>{name}</span>
      <span className="rounded-[6px] bg-success-soft px-[6px] py-[1px] text-[11px] font-semibold text-success-text">{tag}</span>
    </div>
  );
  if (variant === "console") {
    return (
      <div className="flex w-full flex-col items-end gap-1 pt-4">
        {header}
        <div className="flex max-w-[78%] flex-col items-end gap-[2px] rounded-[12px_4px_12px_12px] bg-analyst-soft px-3 pb-[6px] pt-2">
          <p className="w-full whitespace-pre-wrap break-words text-[14.5px] leading-[21px] text-ink">{text}</p>
          <time className="text-[11px] text-ink-3">{formatTime(createdAt)}</time>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-start gap-[6px]">
      {header}
      <div className="max-w-[600px] rounded-[4px_12px_12px_12px] bg-analyst-soft px-4 py-3 text-[14.5px] leading-[22px] text-ink">
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}
