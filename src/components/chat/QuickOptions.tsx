"use client";

export function QuickOptions({ options, disabled, onPick }: { options: string[]; disabled: boolean; onPick: (option: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[6px]" role="group" aria-label="Opções rápidas">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option)}
          className="rounded-[8px] bg-paper px-3 py-[7px] text-[13.5px] font-medium text-ink outline outline-1 -outline-offset-1 outline-ink/15 transition-colors hover:bg-primary-soft hover:text-primary-text hover:outline-primary/30 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-paper disabled:hover:text-ink"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
