import { Skeleton } from "@/components/ui/Skeleton";
import type { ConsoleListItem } from "@/lib/types";
import { ConversationListItem } from "./ConversationListItem";

export function ConversationList({ items, loading, selectedId, onSelect }: { items: ConsoleListItem[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-2" aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-[10px]">
            <Skeleton className="h-[46px] w-[46px] !rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="px-6 py-10 text-center text-[13.5px] text-ink-3">Nenhuma conversa aqui</p>;
  }
  return (
    <ul className="flex flex-col px-2">
      {items.map((item) => (
        <li key={item.id}>
          <ConversationListItem item={item} selected={item.id === selectedId} onSelect={() => onSelect(item.id)} />
        </li>
      ))}
    </ul>
  );
}
