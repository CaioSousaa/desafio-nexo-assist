import { MessagesSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { NexoMark } from "@/components/ui/NexoMark";

export function ConsoleRail({ analystName, waiting }: { analystName: string; waiting: number }) {
  return (
    <nav aria-label="Console" className="flex h-full w-16 shrink-0 flex-col items-center gap-[6px] border-r border-rule bg-desk py-4">
      <div className="flex h-10 w-10 items-center justify-center pb-2">
        <NexoMark size={22} />
      </div>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-[12px] bg-paper text-ink shadow-[0_1px_2px_#1B24310D]" title="Conversas" aria-current="page">
        <MessagesSquare size={19} />
        {waiting > 0 && (
          <span className="absolute left-6 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-[5px] text-[10px] font-bold text-white" aria-label={`${waiting} esperando atendente`}>
            {waiting}
          </span>
        )}
      </span>
      <div className="flex-1" />
      <Avatar name={analystName} size={36} tone="primary" online />
    </nav>
  );
}
