import { Search } from "lucide-react";

export function ConsoleSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-9 w-full items-center gap-[10px] rounded-full bg-desk px-3 text-ink-3 focus-within:outline focus-within:outline-2 focus-within:outline-primary">
      <Search size={15} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Pesquisar conversa ou chamado"
        aria-label="Pesquisar conversa ou chamado"
        className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  );
}
