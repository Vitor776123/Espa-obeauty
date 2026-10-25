import "server-only";
import { db } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/dados";
import { buscarPagamentoMP, criarPix, mpAtivo } from "@/lib/mercadopago";
import { agendamentoPorId, calcularCobranca } from "@/lib/reservas";
import { avisarCliente, avisarEquipe, seguro } from "@/lib/push";
import { dataCurta, formatBRL } from "@/lib/tempo";
import type { AgendamentoCompleto } from "@/lib/tipos";

export type PixParaTela = {
  copiaECola: string;
  qrBase64: string;
  valor: number;
  expiraEm: string;
};

/** Cria a cobrança PIX no Mercado Pago e guarda no banco. Só chamar com mpAtivo(). */
export async function criarCobrancaPix(ag: AgendamentoCompleto): Promise<PixParaTela> {
  const cfg = await getConfig();
  const valor = calcularCobranca(ag.valor_total, ag.tipo_pagamento, cfg.sinal_percentual);
  if (valor <= 0) throw new Error("Nada a cobrar neste agendamento.");
  const expiraEmMs = ag.expira_em ? new Date(ag.expira_em).getTime() : Date.now() + cfg.hold_minutos * 60_000;

  const pix = await criarPix({
    valor,
    descricao: `${ag.servico.nome} — ${dataCurta(ag.data)} ${ag.inicio}`,
    referencia: ag.id,
    email: ag.cliente.email ?? "",
    nome: ag.cliente.nome,
    expiraEmMs,
  });

  const { error } = await db().from("pagamentos").insert({
    agendamento_id: ag.id,
    provedor: "mercadopago",
    provedor_id: pix.id,
    tipo: ag.tipo_pagamento,
    valor,
    status: "pendente",
    pix_copia_cola: pix.copiaECola,
    pix_qr_base64: pix.qrBase64,
    expira_em: pix.expiraEm,
    raw: pix.bruto as object,
  });
  if (error) throw new Error(`Falha ao salvar pagamento: ${error.message}`);
  return { copiaECola: pix.copiaECola, qrBase64: pix.qrBase64, valor, expiraEm: pix.expiraEm };
}

/** PIX já criado e ainda válido para esta reserva (para reabrir a tela de pagamento). */
export async function pixPendente(agendamentoId: string): Promise<PixParaTela | null> {
  const { data } = await db()
    .from("pagamentos")
    .select("valor, pix_copia_cola, pix_qr_base64, expira_em")
    .eq("agendamento_id", agendamentoId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.pix_copia_cola || !data.expira_em) return null;
  if (new Date(data.expira_em).getTime() <= Date.now()) return null;
  return {
    copiaECola: data.pix_copia_cola,
    qrBase64: data.pix_qr_base64 ?? "",
    valor: Number(data.valor),
    expiraEm: data.expira_em,
  };
}

/**
 * Registra um valor recebido (pelo webhook ou pela equipe) e confirma o agendamento.
 * Idempotente por chamada: quem chama garante que o mesmo pagamento não entra duas vezes.
 */
export async function registrarRecebimento(agendamentoId: string, valor: number, origem: "mercadopago" | "equipe") {
  const ag = await agendamentoPorId(agendamentoId);
  if (!ag) return { ok: false as const, erro: "Agendamento não encontrado." };

  const pago = Math.min(ag.valor_total, Math.round((ag.valor_pago + valor) * 100) / 100);
  const quitado = pago >= ag.valor_total;
  const patch: Record<string, unknown> = {
    valor_pago: pago,
    pagamento_status: quitado ? "pago_total" : "sinal_pago",
  };

  let nota = "";
  if (ag.status === "aguardando_pagamento" || ag.status === "pendente") {
    patch.status = "confirmado";
    patch.expira_em = null;
  } else if (ag.status === "expirado" || ag.status === "cancelado") {
    // pagamento chegou depois de o horário ser liberado: tenta reativar
    const tenta = await db()
      .from("agendamentos")
      .update({ ...patch, status: "confirmado", expira_em: null })
      .eq("id", ag.id);
    if (tenta.error) {
      nota = "Pagamento recebido depois de o horário ser liberado e o horário já foi ocupado. Reembolsar ou remarcar.";
      await db()
        .from("agendamentos")
        .update({ ...patch, observacoes: [ag.observacoes, nota].filter(Boolean).join(" | ") })
        .eq("id", ag.id);
      await seguro(() =>
        avisarEquipe({
          titulo: "Pagamento sem horário",
          corpo: `${ag.cliente.nome} pagou ${formatBRL(valor)} depois de o horário expirar. Veja no painel.`,
          url: "/painel/agenda",
          tag: `sem-horario-${ag.id}`,
        }),
      );
      return { ok: true as const, reativado: false };
    }
    await notificarConfirmacao(ag, valor, quitado);
    return { ok: true as const, reativado: true };
  }

  const { error } = await db().from("agendamentos").update(patch).eq("id", ag.id);
  if (error) return { ok: false as const, erro: error.message };

  if (origem === "mercadopago" || patch.status === "confirmado") await notificarConfirmacao(ag, valor, quitado);
  return { ok: true as const, reativado: false };
}

async function notificarConfirmacao(ag: AgendamentoCompleto, valor: number, quitado: boolean) {
  await seguro(() =>
    avisarCliente(ag.id, {
      titulo: "Horário confirmado",
      corpo: `${ag.servico.nome}, ${dataCurta(ag.data)} às ${ag.inicio}. Te esperamos!`,
      url: `/reserva/${ag.token_gerenciar}`,
      tag: `ag-${ag.id}`,
    }),
  );
  await seguro(() =>
    avisarEquipe({
      titulo: "Novo horário confirmado",
      corpo: `${ag.cliente.nome} · ${ag.servico.nome} · ${dataCurta(ag.data)} ${ag.inicio} · ${quitado ? "pago" : "sinal"} ${formatBRL(valor)}`,
      url: "/painel/agenda",
      tag: `novo-${ag.id}`,
    }),
  );
}

/** Webhook do Mercado Pago: consulta a API (fonte da verdade) e aplica o resultado. */
export async function processarWebhookMP(provedorId: string): Promise<{ ok: boolean; detalhe: string }> {
  if (!mpAtivo()) return { ok: false, detalhe: "Mercado Pago não configurado." };
  const mp = await buscarPagamentoMP(provedorId);
  if (!mp) return { ok: false, detalhe: "Pagamento não existe no Mercado Pago." };

  const { data: linha } = await db()
    .from("pagamentos")
    .select("id, agendamento_id, valor, status")
    .eq("provedor", "mercadopago")
    .eq("provedor_id", mp.id)
    .maybeSingle();
  if (!linha) return { ok: false, detalhe: "Pagamento desconhecido." };

  const mapa: Record<string, string> = {
    approved: "aprovado",
    authorized: "aprovado",
    rejected: "recusado",
    cancelled: "cancelado",
    refunded: "reembolsado",
    charged_back: "reembolsado",
  };
  const novo = mapa[mp.status] ?? "pendente";
  if (novo === linha.status) return { ok: true, detalhe: "Sem mudança." };

  // trava otimista: só quem muda o status primeiro aplica o recebimento
  const { data: mudou } = await db()
    .from("pagamentos")
    .update({ status: novo })
    .eq("id", linha.id)
    .eq("status", linha.status)
    .select("id");
  if (!mudou?.length) return { ok: true, detalhe: "Já processado." };

  if (novo === "aprovado") {
    // confere o valor pago contra o valor cobrado
    if (Math.abs(mp.transaction_amount - Number(linha.valor)) > 0.01) {
      await db().from("pagamentos").update({ status: "pendente" }).eq("id", linha.id);
      return { ok: false, detalhe: "Valor divergente." };
    }
    await registrarRecebimento(linha.agendamento_id, Number(linha.valor), "mercadopago");
    return { ok: true, detalhe: "Pagamento aprovado." };
  }
  return { ok: true, detalhe: `Status: ${novo}` };
}
