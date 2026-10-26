import type { ConsoleFilter } from "@/lib/types";

const LABELS: Array<[ConsoleFilter, string]> = [
  ["todas", "Todas"],
  ["para_voce", "Para você"],
  ["com_agent", "Com o agent"],
  ["minhas", "Minhas"],
];

export function ConsoleFilters({ value, counts, onChange }: { value: ConsoleFilter; counts: Record<ConsoleFilter, number>; onChange: (filter: ConsoleFilter) => void }) {
  return (
    <div role="tablist" aria-label="Filtrar conversas" className="flex flex-wrap gap-1">
      {LABELS.map(([key, label]) => {
        const active = key === value;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`flex items-center gap-[6px] rounded-full px-[9px] py-[6px] text-[12.5px] font-medium ${active ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule"}`}
          >
            {label}
            {key !== "todas" && <span className={`font-semibold ${active ? "text-primary-text" : "text-ink-3"}`}>{counts[key]}</span>}
          </button>
        );
      })}
    </div>
  );
}
