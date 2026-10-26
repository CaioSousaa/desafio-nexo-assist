import { Avatar } from "@/components/ui/Avatar";
import { formatListTime } from "@/lib/format";
import type { ConsoleListItem, LabelTone } from "@/lib/types";

const tagStyle: Record<LabelTone, { dot: string | null; text: string }> = {
  warning: { dot: "bg-danger", text: "text-danger-text" },
  violet: { dot: "bg-violet", text: "text-violet-text" },
  neutral: { dot: "bg-primary", text: "text-primary-text" },
  primary: { dot: "bg-success", text: "text-success-text" },
  success: { dot: null, text: "text-ink-3" },
  muted: { dot: null, text: "text-ink-3" },
};

export function ConversationListItem({ item, selected, onSelect }: { item: ConsoleListItem; selected: boolean; onSelect: () => void }) {
  const unread = item.unread > 0 && !selected;
  const tag = tagStyle[item.tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-[12px] p-[10px] text-left transition-colors ${selected ? "bg-desk" : "hover:bg-desk/70"}`}
    >
      <Avatar name={item.employee.name} size={46} online={item.state !== "encerrada"} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-center gap-2">
          <span className={`flex-1 truncate text-[15.5px] text-ink ${unread ? "font-semibold" : "font-medium"}`}>{item.employee.name}</span>
          <span className={`shrink-0 text-[12.5px] ${unread ? "font-semibold text-cta" : "text-ink-3"}`}>{formatListTime(item.lastAt)}</span>
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="flex-1 truncate text-[13.5px] text-ink-3">{item.preview}</span>
          {unread && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-[6px] text-[11.5px] font-bold text-white" aria-label={`${item.unread} não lidas`}>
              {item.unread}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-[5px] text-[11.5px] font-medium ${tag.text}`}>
          {tag.dot && <span className={`h-[6px] w-[6px] rounded-full ${tag.dot}`} />}
          {item.label}
          {item.late && <span className="rounded-[4px] bg-danger-soft px-1 text-danger-text">atrasada</span>}
        </span>
      </div>
    </button>
  );
}
