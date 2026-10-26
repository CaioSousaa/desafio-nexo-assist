import type { Category } from "../rules/catalog";

export interface HelpArticle {
  id: string;
  title: string;
  body: string;
  category: Category;
  /** Condições de aplicação; o servidor compara com o dispositivo do funcionário. */
  conditions?: { os?: string[] };
  keywords: string[];
}

// Central de ajuda da Nexo (inclui os dois artigos do Anexo B, com o texto literal).
export const ARTICLES: HelpArticle[] = [
  {
    id: "horario-service-desk",
    title: "Horário do service desk",
    body: "Horário do service desk: de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
    category: "Outros",
    keywords: ["horário", "que horas", "até que horas", "atende", "atendimento", "suporte", "funciona", "plantão", "expediente", "aberto"],
  },
  {
    id: "vpn-erro-809",
    title: "VPN com erro 809",
    body: "VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
    category: "Rede e VPN",
    conditions: { os: ["Windows 10"] },
    keywords: ["vpn", "809", "erro 809", "conectar", "conexão remota", "reinstalar"],
  },
  {
    id: "vpn-nao-conecta",
    title: "VPN não conecta",
    body: "Se a VPN não conecta: confirme que a internet funciona sem a VPN, feche e abra o cliente de VPN e aprove a notificação do autenticador (MFA) no celular. Se aparecer um código de erro, procure o artigo do código ou abra um chamado informando o código.",
    category: "Rede e VPN",
    keywords: ["vpn", "não conecta", "conexão", "home office", "acesso remoto", "mfa", "autenticador"],
  },
  {
    id: "senha-rede-bloqueada",
    title: "Senha da rede expirada ou bloqueada",
    body: "A senha da rede expira a cada 90 dias. Para trocar ou desbloquear, use o portal senha.nexo.com.br com o autenticador do celular. Após 5 tentativas erradas a conta fica bloqueada por 30 minutos. Se o portal não reconhecer você, abra um chamado de Acesso.",
    category: "Acesso",
    keywords: ["senha", "bloqueada", "expirada", "desbloquear", "trocar senha", "redefinir", "login", "acesso"],
  },
  {
    id: "wifi-visitantes",
    title: "Wi-Fi para visitantes",
    body: "A rede Nexo-Visitantes é liberada por convite: informe o nome e o e-mail do visitante no portal da recepção e a senha do dia é enviada para o e-mail dele. A senha vale até as 23h59.",
    category: "Rede e VPN",
    keywords: ["wi-fi", "wifi", "visitante", "convidado", "rede sem fio", "senha do wifi", "internet"],
  },
  {
    id: "email-caixa-cheia",
    title: "Caixa de e-mail cheia",
    body: "Quando a caixa passa de 50 GB, novos e-mails param de chegar. Esvazie a lixeira, arquive mensagens antigas em Arquivo Online e apague anexos grandes. Se precisar de mais espaço por motivo de trabalho, abra um pedido (REQ) de E-mail.",
    category: "E-mail",
    keywords: ["e-mail", "email", "caixa cheia", "espaço", "outlook", "não recebo", "cota"],
  },
  {
    id: "impressora-nao-imprime",
    title: "Impressora não imprime",
    body: "Verifique se a impressora do andar aparece como Nexo-Print no computador e se há papel e toner. Remova trabalhos travados na fila de impressão e tente de novo. Se a impressora mostrar erro no visor, abra um chamado de Hardware informando o andar.",
    category: "Hardware",
    keywords: ["impressora", "imprimir", "impressão", "toner", "papel", "fila de impressão"],
  },
  {
    id: "pedido-software-equipamento",
    title: "Como pedir software ou equipamento",
    body: "Softwares gratuitos homologados estão no portal de softwares, sem chamado. Software pago, segundo monitor, periféricos e outros equipamentos são pedidos (REQ) e passam por aprovação do gestor; o prazo padrão é de 5 dias úteis.",
    category: "Software",
    keywords: ["instalar", "software", "programa", "licença", "monitor", "equipamento", "periférico", "mouse", "teclado", "pedido"],
  },
];
