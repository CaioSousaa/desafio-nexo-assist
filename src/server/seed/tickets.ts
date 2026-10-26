import type { SeedTicket } from "../tickets/local-service";
import type { Ticket } from "../tickets";
import type { TicketEventKind } from "../tickets/types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Spec = Omit<Ticket, "createdAt" | "updatedAt" | "resolvedAt"> & {
  created: number;
  updated: number;
  resolved?: number;
  events: Array<{ kind: TicketEventKind; text: string; author: string; ago: number }>;
};

/**
 * Chamados de exemplo (Anexo B + situações do FR-101). Datas relativas a `now`, para que o INC-20311 esteja
 * sempre vencido e o INC-20150 sempre dentro dos 7 dias de reabertura (prd.md § Premissas).
 */
export function seedTickets(now: Date): SeedTicket[] {
  const iso = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
  const specs: Spec[] = [
    // Ana Souza (conta de demonstração): 3 abertos, 3 encerrados
    {
      number: "INC-20311", kind: "INC", title: "Notebook lento após atualização", category: "Hardware", priority: "Média", affected: "somente_voce",
      description: "Depois da atualização do Windows o notebook demora vários minutos para abrir o Excel e o Teams.",
      requesterEmail: "ana.souza@nexo.com.br", status: "aguardando_analista",
      created: 10 * DAY, updated: 6 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Ana Souza", ago: 10 * DAY },
        { kind: "status", text: "Aguardando analista para diagnóstico remoto.", author: "Juliana Costa", ago: 6 * DAY },
      ],
    },
    {
      number: "INC-20298", kind: "INC", title: "Outlook não sincroniza no celular", category: "E-mail", priority: "Média", affected: "somente_voce",
      description: "O app do Outlook no celular parou de receber e-mails novos desde a troca de senha.",
      requesterEmail: "ana.souza@nexo.com.br", status: "em_andamento",
      created: 3 * DAY, updated: 1 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Ana Souza", ago: 3 * DAY },
        { kind: "nota", text: "Pedimos para remover e adicionar a conta de novo; aguardando retorno.", author: "Rafael Lima", ago: 1 * DAY },
      ],
    },
    {
      number: "REQ-10442", kind: "REQ", title: "Acesso ao Power BI", category: "Acesso", priority: "Baixa", affected: "somente_voce",
      description: "Acesso de leitura ao workspace Financeiro no Power BI.",
      requesterEmail: "ana.souza@nexo.com.br", status: "aprovado",
      created: 4 * DAY, updated: 1 * DAY,
      events: [
        { kind: "criado", text: "Pedido aberto pelo formulário.", author: "Ana Souza", ago: 4 * DAY },
        { kind: "status", text: "Aprovado pelo gestor; liberação em andamento.", author: "Juliana Costa", ago: 1 * DAY },
      ],
    },
    {
      number: "INC-20150", kind: "INC", title: "Senha do SAP bloqueada", category: "Acesso", priority: "Alta", affected: "somente_voce",
      description: "A senha do SAP bloqueou após tentativas erradas e o portal não desbloqueava.",
      requesterEmail: "ana.souza@nexo.com.br", status: "resolvido",
      created: 6 * DAY, updated: 4 * DAY, resolved: 4 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Ana Souza", ago: 6 * DAY },
        { kind: "status", text: "Senha desbloqueada no SAP.", author: "Rafael Lima", ago: 4 * DAY },
      ],
    },
    {
      number: "INC-19877", kind: "INC", title: "Teclado com teclas falhando", category: "Hardware", priority: "Baixa", affected: "somente_voce",
      description: "Teclas A e S do notebook falhando.", requesterEmail: "ana.souza@nexo.com.br", status: "resolvido",
      created: 60 * DAY, updated: 54 * DAY, resolved: 54 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Ana Souza", ago: 60 * DAY },
        { kind: "status", text: "Teclado substituído.", author: "Juliana Costa", ago: 54 * DAY },
      ],
    },
    {
      number: "INC-19410", kind: "INC", title: "VPN não conectava em casa", category: "Rede e VPN", priority: "Média", affected: "somente_voce",
      description: "VPN não conectava na rede de casa; resolvido reconfigurando o perfil.", requesterEmail: "ana.souza@nexo.com.br", status: "resolvido",
      created: 95 * DAY, updated: 90 * DAY, resolved: 90 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Ana Souza", ago: 95 * DAY },
        { kind: "status", text: "Perfil da VPN reconfigurado.", author: "Rafael Lima", ago: 90 * DAY },
      ],
    },
    // Outros funcionários
    {
      number: "REQ-10451", kind: "REQ", title: "Acesso ao SAP (módulo FI)", category: "Acesso", priority: "Média", affected: "somente_voce",
      description: "Acesso ao módulo FI do SAP para lançar notas de clientes ainda hoje.", requesterEmail: "carla.mendes@nexo.com.br", status: "aberto",
      created: 50 * MIN, updated: 50 * MIN,
      events: [{ kind: "criado", text: "Chamado aberto pelo Nexo Assist após confirmação do funcionário.", author: "via Nexo Assist", ago: 50 * MIN }],
    },
    {
      number: "INC-20519", kind: "INC", title: "Monitor externo não liga", category: "Hardware", priority: "Média", affected: "somente_voce",
      description: "O monitor externo da mesa não liga desde ontem; o notebook funciona normalmente.", requesterEmail: "diego.ramos@nexo.com.br", status: "aberto",
      created: 20 * MIN, updated: 20 * MIN,
      events: [{ kind: "criado", text: "Chamado aberto pelo Nexo Assist após confirmação do funcionário.", author: "via Nexo Assist", ago: 20 * MIN }],
    },
    {
      number: "INC-20102", kind: "INC", title: "Leitor de código de barras sem resposta", category: "Hardware", priority: "Alta", affected: "equipe",
      description: "Leitor da doca 2 parou de ler etiquetas.", requesterEmail: "bruno.tavares@nexo.com.br", status: "resolvido",
      created: 30 * DAY, updated: 29 * DAY, resolved: 29 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Bruno Tavares", ago: 30 * DAY },
        { kind: "status", text: "Leitor trocado.", author: "Juliana Costa", ago: 29 * DAY },
      ],
    },
    {
      number: "REQ-10448", kind: "REQ", title: "Aumento da caixa de e-mail", category: "E-mail", priority: "Baixa", affected: "somente_voce",
      description: "Caixa de e-mail cheia; pedido de mais espaço por causa dos processos seletivos.", requesterEmail: "gabriela.rocha@nexo.com.br", status: "em_atendimento",
      created: 2 * DAY, updated: 1 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo Nexo Assist após confirmação do funcionário.", author: "via Nexo Assist", ago: 2 * DAY },
        { kind: "assumido", text: "Assumido por Rafael Lima", author: "Rafael Lima", ago: 1 * DAY + 2 * HOUR },
        { kind: "nota", text: "Atendimento encerrado por Rafael Lima", author: "Rafael Lima", ago: 1 * DAY },
      ],
    },
    {
      number: "INC-20233", kind: "INC", title: "Docker sem acesso ao registry interno", category: "Rede e VPN", priority: "Média", affected: "somente_voce",
      description: "docker pull do registry interno falhava fora da VPN.", requesterEmail: "fabio.nunes@nexo.com.br", status: "resolvido",
      created: 20 * DAY, updated: 18 * DAY, resolved: 18 * DAY,
      events: [
        { kind: "criado", text: "Chamado aberto pelo formulário.", author: "Fábio Nunes", ago: 20 * DAY },
        { kind: "status", text: "Certificado do registry atualizado.", author: "Rafael Lima", ago: 18 * DAY },
      ],
    },
  ];
  return specs.map(({ created, updated, resolved, events, ...ticket }) => ({
    ticket: { ...ticket, createdAt: iso(created), updatedAt: iso(updated), resolvedAt: resolved === undefined ? null : iso(resolved) },
    events: events.map((e) => ({ kind: e.kind, text: e.text, author: e.author, createdAt: iso(e.ago) })),
  }));
}
