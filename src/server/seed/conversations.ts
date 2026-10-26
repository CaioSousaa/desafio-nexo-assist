import { formatTime } from "@/lib/format";
import type { ConversationOutcome, ConversationState, TransferReason, TransferSummary } from "../conversations/repo";
import type { DraftKind, DraftPayload, DraftStatus } from "../drafts/repo";
import type { AuthorType, MessageParts, SystemEventType } from "../messages/repo";

// Conversas prontas de outros funcionários (D8), escritas à mão no mesmo formato das reais.
// Toda mensagem do agent tem registro de decisão completo para o bloco de detalhe abrir (FR-104).

export interface SeedStep {
  tool: string;
  labels: string[];
  input: string;
  output: string;
  ms?: number;
  visible?: boolean;
  articleTitle?: string;
}

export interface SeedDecision {
  intent: string;
  entities?: Record<string, string>;
  assumptions?: string[];
  action: string;
  confidence: number;
  rationale: string;
  rules: string[];
  steps: SeedStep[];
  source?: "seed";
}

export interface SeedMessage {
  by: AuthorType;
  minutesAgo: number;
  text?: string;
  parts?: MessageParts;
  event?: SystemEventType;
  authorId?: string;
  decision?: SeedDecision;
  counts?: boolean;
}

export interface SeedDraft {
  key: string;
  displayCode: string;
  kind: DraftKind;
  status: DraftStatus;
  payload: Omit<DraftPayload, "deadlineAt"> & { deadlineMinutesFromCreation: number };
  resultingTicket: string | null;
  minutesAgo: number;
  decidedMinutesAgo: number | null;
}

export interface SeedConversation {
  id: string;
  employeeId: string;
  state: ConversationState;
  outcome?: ConversationOutcome;
  assignedAnalystId?: string;
  transferReason?: TransferReason;
  transferConfidence?: number;
  transferSummary?: TransferSummary;
  transferredMinutesAgo?: number;
  focusTicket?: string;
  relatedTickets: string[];
  closedMinutesAgo?: number;
  drafts?: SeedDraft[];
  messages: SeedMessage[];
}

const LIST = (input = "includeResolvedDays=30", output = "nenhum chamado parecido"): SeedStep => ({
  tool: "list_my_tickets",
  labels: ["consultou seus chamados"],
  input,
  output,
  ms: 140,
});
const SEARCH = (query: string, output: string, articleTitle?: string): SeedStep => ({
  tool: "search_help_center",
  labels: ["buscou na central de ajuda"],
  input: `query="${query}"`,
  output,
  ms: 12,
  ...(articleTitle ? { articleTitle } : {}),
});
const RECORD = (action: string, confidence: number): SeedStep => ({
  tool: "record_decision",
  labels: [],
  input: `action=${action} confidence=${confidence}`,
  output: "registrada",
  visible: false,
  ms: 3,
});

export function seedConversations(now: Date): SeedConversation[] {
  const at = (minutesAgo: number) => formatTime(new Date(now.getTime() - minutesAgo * 60_000));
  const DAY = 24 * 60;
  return [
    {
      id: "seed-conv-carla",
      employeeId: "u-carla",
      state: "aguardando_atendente",
      transferReason: "pedido",
      transferredMinutesAgo: 40,
      focusTicket: "REQ-10451",
      relatedTickets: ["REQ-10451"],
      transferSummary: {
        problem: "Precisa de acesso ao módulo FI do SAP ainda hoje para lançar as notas de um cliente.",
        done: "Consultou os chamados, abriu o REQ-10451 (Média) após confirmação e transferiu a pedido da funcionária.",
        tickets: ["REQ-10451"],
        priority: "Média",
        reason: "pedido",
      },
      drafts: [
        {
          key: "carla",
          displayCode: "D-376",
          kind: "novo",
          status: "confirmado",
          resultingTicket: "REQ-10451",
          minutesAgo: 54,
          decidedMinutesAgo: 50,
          payload: {
            title: "Acesso ao SAP (módulo FI)",
            description: "Acesso ao módulo FI do SAP para lançar notas de clientes ainda hoje.",
            type: "REQ",
            category: "Acesso",
            priority: "Média",
            affected: "somente_voce",
            rule: "Pedido com urgência declarada: prioridade Média (3 dias úteis).",
            assumptions: [],
            duplicateCheck: { considered: [], verdict: "nenhum", why: "Carla não tem pedido de acesso ao SAP aberto." },
            deadlineMinutesFromCreation: 3 * DAY,
          },
        },
      ],
      messages: [
        { by: "funcionario", minutesAgo: 55, text: "Preciso de acesso ao SAP, módulo FI. Tenho que lançar as notas de um cliente ainda hoje.", counts: true },
        {
          by: "agent",
          minutesAgo: 54,
          text: "Você não tem pedido de acesso ao SAP aberto, então montei o rascunho abaixo. Como é para hoje, a prioridade ficou Média. Confere e confirma?",
          parts: { draft_id: "seed-draft-carla" },
          decision: {
            intent: "Pedir acesso ao SAP (módulo FI) para hoje",
            entities: { sistema: "SAP", módulo: "FI", prazo: "hoje" },
            action: "propor_chamado",
            confidence: 86,
            rationale: "É um pedido de acesso, então o tipo é REQ e a categoria Acesso. Não há pedido igual aberto. A urgência de hoje sobe a prioridade para Média.",
            rules: ["RN-001 · REQ para pedido de acesso", "RN-004 · Sem duplicidade", "RN-008 · Prioridade por impacto e urgência"],
            steps: [
              LIST(),
              SEARCH("acesso SAP módulo FI", "nenhum artigo encontrado"),
              { tool: "classify_priority", labels: ["classificou a prioridade", "consultou o SLA"], input: "kind=REQ impact=somente_voce sameDayCommitment=true", output: "Média · resposta em 3 dias úteis", ms: 4 },
              { tool: "propose_draft", labels: ["montou o rascunho"], input: "kind=novo type=REQ category=Acesso", output: "rascunho D-376 · Média", ms: 21 },
              RECORD("propor_chamado", 86),
            ],
          },
        },
        {
          by: "agent",
          minutesAgo: 50,
          text: "Pronto: abri o chamado REQ-10451 com prioridade Média.",
          decision: {
            intent: "Funcionária confirmou o rascunho",
            entities: { chamado: "REQ-10451" },
            action: "registrar_chamado",
            confidence: 100,
            rationale: "A funcionária confirmou o rascunho, então o chamado foi gravado no serviço de chamados.",
            rules: ["RN-003 · Chamado só é criado depois da confirmação do funcionário"],
            steps: [{ tool: "tickets.create", labels: ["criou o chamado"], input: "REQ · Acesso · Média", output: "REQ-10451", ms: 88 }],
          },
        },
        { by: "funcionario", minutesAgo: 42, text: "Dá para alguém liberar agora? O cliente está esperando.", counts: true },
        {
          by: "agent",
          minutesAgo: 41,
          text: "Entendi a urgência. Vou chamar um analista para isso, com o resumo do que você já contou.",
          decision: {
            intent: "Falar com uma pessoa para acelerar o acesso",
            entities: { chamado: "REQ-10451" },
            action: "transferir",
            confidence: 90,
            rationale: "A funcionária pediu atendimento humano para acelerar a liberação. Pedido explícito transfere a conversa com resumo.",
            rules: ["RN-005 · Transferência quando o funcionário pede"],
            steps: [{ tool: "request_transfer", labels: ["transferiu para analista"], input: "reason=pedido", output: "transferência agendada", ms: 2 }, RECORD("transferir", 90)],
          },
        },
        { by: "sistema", minutesAgo: 40, event: "transferida", text: `Transferida para o service desk · ${at(40)}` },
        { by: "funcionario", minutesAgo: 12, text: "Preciso de acesso ao SAP ainda hoje" },
      ],
    },
    {
      id: "seed-conv-bruno",
      employeeId: "u-bruno",
      state: "aguardando_atendente",
      transferReason: "baixa_confianca",
      transferConfidence: 41,
      transferredMinutesAgo: 15,
      relatedTickets: [],
      transferSummary: {
        problem: "Erro ao exportar no sistema da transportadora: aparece uma tela cinza e o sistema volta para o início.",
        done: "Consultou os chamados e a central de ajuda, sem nada parecido. Transferiu por falta de segurança (41%).",
        tickets: [],
        priority: null,
        reason: "baixa_confianca",
      },
      messages: [
        { by: "funcionario", minutesAgo: 18, text: "o sistema da transportadora tá dando um erro estranho quando exporto, aparece uma tela cinza e volta", counts: true },
        {
          by: "agent",
          minutesAgo: 16,
          text: "Não achei artigo nem chamado parecido, e o sistema da transportadora não está no catálogo da TI. Vou chamar um analista para isso.",
          decision: {
            intent: "Erro ao exportar no sistema da transportadora",
            entities: { sistema: "sistema da transportadora", sintoma: "tela cinza ao exportar" },
            assumptions: ["O sistema da transportadora é de terceiros e pode não ser suportado pela TI"],
            action: "transferir",
            confidence: 41,
            rationale: "Não sei se o sistema é suportado pela TI nem qual a categoria certa. Com pouca segurança, é melhor um analista olhar com o contexto do que abrir um chamado errado.",
            rules: ["RN-005 · Transferência quando o agent não tem segurança", "FR-032 · Confiança abaixo de 60% transfere"],
            steps: [LIST("includeResolvedDays=30", "1 chamado(s), 0 aberto(s)"), SEARCH("erro exportar sistema transportadora tela cinza", "nenhum artigo encontrado"), RECORD("transferir", 41)],
          },
        },
        { by: "sistema", minutesAgo: 15, event: "transferida", text: `Transferida para o service desk · ${at(15)}` },
        { by: "agent", minutesAgo: 15, text: "Vou chamar um analista para isso.", decision: {
          intent: "Conversa transferida para analista",
          action: "avisar_transferencia",
          confidence: 100,
          rationale: "A conversa foi transferida (agent sem segurança). O agent fica em silêncio enquanto um analista atende.",
          rules: ["RN-005 · Transferência leva resumo; o agent não responde enquanto a conversa está com analista"],
          steps: [{ tool: "conversations.transfer", labels: ["transferiu para analista"], input: "Agent sem segurança", output: "aguardando atendente", ms: 6 }],
        } },
      ],
    },
    {
      id: "seed-conv-diego",
      employeeId: "u-diego",
      state: "com_agent",
      focusTicket: "INC-20519",
      relatedTickets: ["INC-20519"],
      drafts: [
        {
          key: "diego",
          displayCode: "D-377",
          kind: "novo",
          status: "confirmado",
          resultingTicket: "INC-20519",
          minutesAgo: 22,
          decidedMinutesAgo: 20,
          payload: {
            title: "Monitor externo não liga",
            description: "O monitor externo da mesa não liga desde ontem; o notebook funciona normalmente.",
            type: "INC",
            category: "Hardware",
            priority: "Média",
            affected: "somente_voce",
            rule: "Afeta só você e há alternativa para seguir trabalhando: prioridade Média (3 dias úteis).",
            assumptions: [],
            duplicateCheck: { considered: [], verdict: "nenhum", why: "Diego não tem chamados abertos." },
            deadlineMinutesFromCreation: 3 * DAY,
          },
        },
      ],
      messages: [
        { by: "funcionario", minutesAgo: 25, text: "Meu monitor externo não liga desde ontem. O notebook funciona.", counts: true },
        {
          by: "agent",
          minutesAgo: 24,
          text: "Não há chamado seu sobre isso e o artigo de impressoras/periféricos não cobre monitor. Quem está sendo afetado?",
          parts: { quick_options: ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"] },
          decision: {
            intent: "Monitor externo não liga",
            entities: { equipamento: "monitor externo", desde: "ontem" },
            action: "pedir_esclarecimento",
            confidence: 82,
            rationale: "Para montar o chamado falta saber quem é afetado, que define a prioridade. O resto já está claro.",
            rules: ["FR-015 · No máximo 2 perguntas antes do rascunho"],
            steps: [LIST("includeResolvedDays=30", "0 chamado(s), 0 aberto(s)"), SEARCH("monitor externo não liga", "nenhum artigo encontrado"), { tool: "offer_options", labels: [], input: 'options=["Só eu","Minha equipe","Toda a empresa","Não sei"]', output: '{"shown":4}', visible: false, ms: 1 }, RECORD("pedir_esclarecimento", 82)],
          },
        },
        { by: "funcionario", minutesAgo: 23, text: "Só eu", counts: true },
        {
          by: "agent",
          minutesAgo: 22,
          text: "Montei o rascunho: Hardware, prioridade Média, porque afeta só você e dá para seguir no notebook. Confere?",
          parts: { draft_id: "seed-draft-diego" },
          decision: {
            intent: "Abrir chamado do monitor externo",
            entities: { afetados: "só eu" },
            action: "propor_chamado",
            confidence: 88,
            rationale: "Algo parou de funcionar, então é INC de Hardware. Afeta só ele e há alternativa (a tela do notebook), por isso Média.",
            rules: ["RN-001 · INC quando algo não funciona", "RN-008 · Prioridade por impacto e urgência"],
            steps: [
              { tool: "classify_priority", labels: ["classificou a prioridade", "consultou o SLA"], input: "kind=INC impact=somente_voce hasWorkaround=true", output: "Média · resposta em 3 dias úteis", ms: 3 },
              { tool: "propose_draft", labels: ["montou o rascunho"], input: "kind=novo type=INC category=Hardware", output: "rascunho D-377 · Média", ms: 18 },
              RECORD("propor_chamado", 88),
            ],
          },
        },
        {
          by: "agent",
          minutesAgo: 20,
          text: "Chamado INC-20519 criado. Prazo de primeira resposta: 3 dias úteis.",
          decision: {
            intent: "Funcionário confirmou o rascunho",
            entities: { chamado: "INC-20519" },
            action: "registrar_chamado",
            confidence: 100,
            rationale: "O funcionário confirmou o rascunho, então o chamado foi gravado no serviço de chamados.",
            rules: ["RN-003 · Chamado só é criado depois da confirmação do funcionário"],
            steps: [{ tool: "tickets.create", labels: ["criou o chamado"], input: "INC · Hardware · Média", output: "INC-20519", ms: 95 }],
          },
        },
      ],
    },
    {
      id: "seed-conv-elisa",
      employeeId: "u-elisa",
      state: "com_agent",
      relatedTickets: [],
      messages: [
        { by: "funcionario", minutesAgo: 8, text: "Como libero o Wi-Fi para um visitante amanhã?", counts: true },
        {
          by: "agent",
          minutesAgo: 7,
          text: "A senha do Wi-Fi é enviada para o e-mail do visitante: cadastre o nome e o e-mail dele no portal da recepção e a senha do dia chega para ele, valendo até as 23h59.",
          decision: {
            intent: "Liberar Wi-Fi para visitante",
            entities: { quando: "amanhã" },
            action: "responder_central",
            confidence: 92,
            rationale: "O artigo \"Wi-Fi para visitantes\" responde exatamente a dúvida e não tem condição de dispositivo. Não precisa de chamado.",
            rules: ["Dúvida coberta por artigo é respondida sem chamado (FR-013)"],
            steps: [SEARCH("liberar Wi-Fi visitante", "Wi-Fi para visitantes", "Wi-Fi para visitantes"), RECORD("responder_central", 92)],
          },
        },
      ],
    },
    {
      id: "seed-conv-fabio",
      employeeId: "u-fabio",
      state: "encerrada",
      outcome: "resolvida_pelo_agent",
      closedMinutesAgo: 184,
      relatedTickets: [],
      messages: [
        { by: "funcionario", minutesAgo: 190, text: "A VPN pede o código do autenticador e não aceita.", counts: true },
        {
          by: "agent",
          minutesAgo: 189,
          text: "Pelo artigo \"VPN não conecta\": feche e abra o cliente de VPN e aprove a notificação do autenticador no celular, em vez de digitar o código. Funcionou?",
          parts: { quick_options: ["Resolveu", "Não resolveu"] },
          decision: {
            intent: "VPN não aceita o código do autenticador",
            entities: { sistema: "VPN", etapa: "MFA" },
            action: "responder_central",
            confidence: 84,
            rationale: "O artigo da VPN cobre falha no autenticador e vale para qualquer sistema. Vale tentar antes de abrir chamado.",
            rules: ["Dúvida coberta por artigo é respondida sem chamado (FR-013)"],
            steps: [LIST("includeResolvedDays=30", "1 chamado(s), 0 aberto(s)"), SEARCH("VPN código autenticador não aceita", "VPN não conecta", "VPN não conecta"), RECORD("responder_central", 84)],
          },
        },
        { by: "funcionario", minutesAgo: 185, text: "Isso resolveu, obrigado!", counts: true },
        {
          by: "agent",
          minutesAgo: 184,
          text: "Que bom! Vou encerrar por aqui. Se precisar, é só escrever.",
          decision: {
            intent: "Confirmou que resolveu",
            action: "encerrar_resolvida",
            confidence: 95,
            rationale: "O funcionário confirmou que resolveu e não há rascunho pendente, então a conversa é encerrada como resolvida pelo agent.",
            rules: ["FR-029 · Encerrar quando o funcionário confirma a solução"],
            steps: [{ tool: "close_as_resolved", labels: ["encerrou a conversa"], input: "{}", output: '{"allowed":true}', ms: 4 }, RECORD("encerrar_resolvida", 95)],
          },
        },
        { by: "sistema", minutesAgo: 184, event: "resolvida", text: `Resolvida pelo agent · ${at(184)}` },
      ],
    },
    {
      id: "seed-conv-gabriela",
      employeeId: "u-gabriela",
      state: "encerrada",
      outcome: "encerrada_pelo_analista",
      assignedAnalystId: "u-rafael",
      transferReason: "pedido",
      transferredMinutesAgo: DAY + 150,
      focusTicket: "REQ-10448",
      relatedTickets: ["REQ-10448"],
      closedMinutesAgo: DAY,
      transferSummary: {
        problem: "Caixa de e-mail cheia; precisa de mais espaço por causa dos processos seletivos.",
        done: "Abriu o REQ-10448 (Baixa) após confirmação e transferiu a pedido da funcionária.",
        tickets: ["REQ-10448"],
        priority: "Baixa",
        reason: "pedido",
      },
      drafts: [
        {
          key: "gabriela",
          displayCode: "D-378",
          kind: "novo",
          status: "confirmado",
          resultingTicket: "REQ-10448",
          minutesAgo: 2 * DAY + 5,
          decidedMinutesAgo: 2 * DAY,
          payload: {
            title: "Aumento da caixa de e-mail",
            description: "Caixa de e-mail cheia; pedido de mais espaço por causa dos processos seletivos.",
            type: "REQ",
            category: "E-mail",
            priority: "Baixa",
            affected: "somente_voce",
            rule: "Pedido de acesso, equipamento ou software sem urgência: prioridade Baixa (5 dias úteis).",
            assumptions: [],
            duplicateCheck: { considered: [], verdict: "nenhum", why: "Sem pedido de e-mail aberto." },
            deadlineMinutesFromCreation: 5 * DAY,
          },
        },
      ],
      messages: [
        { by: "funcionario", minutesAgo: 2 * DAY + 8, text: "Minha caixa de e-mail encheu e não recebo mais nada. Preciso de mais espaço por causa dos processos seletivos.", counts: true },
        {
          by: "agent",
          minutesAgo: 2 * DAY + 5,
          text: "O artigo \"Caixa de e-mail cheia\" diz que mais espaço por motivo de trabalho é um pedido (REQ). Montei o rascunho com prioridade Baixa. Confere?",
          parts: { draft_id: "seed-draft-gabriela" },
          decision: {
            intent: "Mais espaço na caixa de e-mail",
            entities: { motivo: "processos seletivos" },
            action: "propor_chamado",
            confidence: 87,
            rationale: "O artigo indica que aumento de caixa é pedido (REQ) de E-mail. Sem urgência declarada, a prioridade é Baixa.",
            rules: ["RN-001 · REQ para pedido", "RN-008 · Prioridade por impacto e urgência"],
            steps: [
              LIST("includeResolvedDays=30", "0 chamado(s), 0 aberto(s)"),
              SEARCH("caixa de e-mail cheia mais espaço", "Caixa de e-mail cheia", "Caixa de e-mail cheia"),
              { tool: "classify_priority", labels: ["classificou a prioridade", "consultou o SLA"], input: "kind=REQ impact=somente_voce", output: "Baixa · resposta em 5 dias úteis", ms: 3 },
              { tool: "propose_draft", labels: ["montou o rascunho"], input: "kind=novo type=REQ category=E-mail", output: "rascunho D-378 · Baixa", ms: 16 },
              RECORD("propor_chamado", 87),
            ],
          },
        },
        {
          by: "agent",
          minutesAgo: 2 * DAY,
          text: "Pronto: abri o chamado REQ-10448 com prioridade Baixa.",
          decision: {
            intent: "Funcionária confirmou o rascunho",
            entities: { chamado: "REQ-10448" },
            action: "registrar_chamado",
            confidence: 100,
            rationale: "A funcionária confirmou o rascunho, então o chamado foi gravado no serviço de chamados.",
            rules: ["RN-003 · Chamado só é criado depois da confirmação do funcionário"],
            steps: [{ tool: "tickets.create", labels: ["criou o chamado"], input: "REQ · E-mail · Baixa", output: "REQ-10448", ms: 90 }],
          },
        },
        { by: "funcionario", minutesAgo: DAY + 152, text: "Consegue ver isso hoje? Estou perdendo e-mails de candidatos.", counts: true },
        {
          by: "agent",
          minutesAgo: DAY + 151,
          text: "Vou chamar um analista para isso, com o resumo e o REQ-10448.",
          decision: {
            intent: "Falar com uma pessoa para acelerar",
            entities: { chamado: "REQ-10448" },
            action: "transferir",
            confidence: 89,
            rationale: "A funcionária pediu para acelerar e está perdendo e-mails; pedido explícito de atendimento humano transfere a conversa.",
            rules: ["RN-005 · Transferência quando o funcionário pede"],
            steps: [{ tool: "request_transfer", labels: ["transferiu para analista"], input: "reason=pedido", output: "transferência agendada", ms: 2 }, RECORD("transferir", 89)],
          },
        },
        { by: "sistema", minutesAgo: DAY + 150, event: "transferida", text: `Transferida para o service desk · ${at(DAY + 150)}` },
        { by: "sistema", minutesAgo: DAY + 122, event: "assumida", text: `Rafael Lima assumiu · agent pausado · ${at(DAY + 122)}` },
        { by: "analista", minutesAgo: DAY + 120, authorId: "u-rafael", text: "Oi, Gabriela! Aumentei sua caixa para 100 GB. Pode conferir se voltou a chegar?" },
        { by: "funcionario", minutesAgo: DAY + 30, text: "Voltou a chegar, obrigada!" },
        { by: "analista", minutesAgo: DAY + 2, authorId: "u-rafael", text: "Perfeito. Vou encerrar o atendimento; se precisar, é só chamar." },
        { by: "sistema", minutesAgo: DAY, event: "encerrada", text: `Atendimento encerrado · ${at(DAY)}` },
      ],
    },
  ];
}
