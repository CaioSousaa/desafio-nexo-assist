import { NexoMark } from "@/components/ui/NexoMark";

export function LoginShowcase() {
  return (
    <section className="hidden h-full w-[800px] shrink-0 flex-col justify-between bg-ink px-16 pb-12 pt-10 lg:flex">
      <div className="flex items-center gap-[10px]">
        <NexoMark size={24} color="#FFFFFF" />
        <span className="text-[17px] font-bold tracking-[-0.2px] text-white">Nexo Assist</span>
      </div>

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-[18px]">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h1 className="font-display text-[54px] leading-[56px] tracking-[-1.2px] text-white">
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className="w-[520px] text-[16px] leading-[25px] text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.
          </p>
        </div>

        <div className="pl-24">
          <div className="flex w-[500px] flex-col gap-[10px] rounded-[16px] bg-white/[0.04] p-[18px] outline outline-1 -outline-offset-1 outline-white/10">
            <div className="flex justify-end">
              <div className="rounded-[12px_12px_4px_12px] bg-white px-[14px] py-[9px] text-[13.5px] text-ink">
                Meu notebook não conecta na VPN. Erro 809.
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <div className="flex items-center gap-[6px] text-[12.5px]">
                <span className="font-semibold text-white/80">Nexo Assist</span>
                <span className="text-white/45">consultou seus chamados · criou um chamado</span>
              </div>
              <div className="w-[380px] rounded-[4px_12px_12px_12px] bg-white/[0.08] px-[14px] py-[10px] text-[13.5px] leading-[20px] text-white">
                Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
              </div>
              <div className="flex w-fit items-center gap-2 rounded-[12px] bg-white px-3 py-[7px] text-[12.5px]">
                <span className="h-[7px] w-[7px] rounded-full bg-warning" />
                <span className="font-semibold text-ink">INC-20517</span>
                <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl className="flex w-[672px] border-t border-white/10 pt-6">
        {[
          { value: "8 s", label: "primeira resposta, em média" },
          { value: "72%", label: "resolvidos sem fila" },
          { value: "6", label: "analistas online agora", live: true },
        ].map((stat, index) => (
          <div key={stat.label} className={`flex flex-1 flex-col gap-[6px] ${index > 0 ? "border-l border-white/10 pl-6" : ""}`}>
            <dt className="flex items-center gap-2 font-display text-[34px] tracking-[-0.6px] text-white">
              {stat.value}
              {stat.live && <span className="h-2 w-2 rounded-full bg-success" />}
            </dt>
            <dd className="text-[13.5px] text-white/55">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
