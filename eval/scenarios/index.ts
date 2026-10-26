import type { Scenario } from "../types";
import { scenario as alucinacaoNumeroInexistente } from "./alucinacao-numero-inexistente";
import { scenario as baixaConfianca } from "./baixa-confianca";
import { scenario as criticoCancelar } from "./critico-cancelar";
import { scenario as criticoRedeAndar } from "./critico-rede-andar";
import { scenario as duplicadoVpn } from "./duplicado-vpn";
import { scenario as duvidaHorario } from "./duvida-horario";
import { scenario as editarCategoria } from "./editar-categoria";
import { scenario as foraEscopoFerias } from "./fora-escopo-ferias";
import { scenario as naoSeiAfetados } from "./nao-sei-afetados";
import { scenario as novoIncVpn } from "./novo-inc-vpn";
import { scenario as novoReqMonitor } from "./novo-req-monitor";
import { scenario as obrigadoAmbiguo } from "./obrigado-ambiguo";
import { scenario as obrigadoEncerra } from "./obrigado-encerra";
import { scenario as pedidoAnalista } from "./pedido-analista";
import { scenario as pedirCriticaSemMotivo } from "./pedir-critica-sem-motivo";
import { scenario as privacidadeFinanceiro } from "./privacidade-financeiro";
import { scenario as privacidadeNumeroAlheio } from "./privacidade-numero-alheio";
import { scenario as reabertura10d } from "./reabertura-10d";
import { scenario as reabertura6d } from "./reabertura-6d";
import { scenario as semArtigoOferece } from "./sem-artigo-oferece";
import { scenario as status0 } from "./status-0";
import { scenario as status1Aberto } from "./status-1-aberto";
import { scenario as status3Abertos } from "./status-3-abertos";
import { scenario as vencidoOferta } from "./vencido-oferta";
import { scenario as vencidoRecusa } from "./vencido-recusa";
import { scenario as vpn809Win11 } from "./vpn-809-win11";

export const SCENARIOS: Scenario[] = [
  duvidaHorario,
  vpn809Win11,
  foraEscopoFerias,
  semArtigoOferece,
  obrigadoEncerra,
  obrigadoAmbiguo,
  novoIncVpn,
  novoReqMonitor,
  naoSeiAfetados,
  editarCategoria,
  pedirCriticaSemMotivo,
  criticoRedeAndar,
  criticoCancelar,
  pedidoAnalista,
  baixaConfianca,
  status3Abertos,
  status1Aberto,
  status0,
  vencidoOferta,
  vencidoRecusa,
  privacidadeNumeroAlheio,
  privacidadeFinanceiro,
  alucinacaoNumeroInexistente,
  duplicadoVpn,
  reabertura6d,
  reabertura10d,
];
