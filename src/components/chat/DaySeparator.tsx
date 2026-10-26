export function DaySeparator({ label, variant = "day" }: { label: string; variant?: "day" | "closed" }) {
  if (variant === "closed") {
    return (
      <div className="flex w-full items-center gap-3 py-4" role="separator" aria-label={label}>
        <span className="h-px flex-1 bg-ink/15" />
        <span className="rounded-full bg-desk px-3 py-1 text-[12px] font-medium text-ink-3">{label}</span>
        <span className="h-px flex-1 bg-ink/15" />
      </div>
    );
  }
  return (
    <div className="flex w-full justify-center pb-1 pt-3" role="separator" aria-label={label}>
      <span className="rounded-full bg-white/80 px-[10px] py-1 text-[12px] font-medium text-ink-3 shadow-[0_1px_1px_#1B24310D]">{label}</span>
    </div>
  );
}
