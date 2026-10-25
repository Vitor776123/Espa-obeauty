"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";
import { getConfig } from "@/lib/dados";
import { registrarRecebimento } from "@/lib/pagamentos";
import { avisarCliente, seguro } from "@/lib/push";
import {
  agendamentoPorId,
  calcularCobranca,
  calcularDisponibilidade,
  expirarVencidas,
  resolverOferta,
} from "@/lib/reservas";
import { dataCurta, dataValida, hhmmParaMin, minParaHhmm } from "@/lib/tempo";
import type { AgendamentoCompleto } from "@/lib/tipos";

export type Resposta = { ok: true } | { ok: false; erro: string };

const uuid = z.uuid();

/** Carrega o agendamento e garante que a pessoa logada pode mexer nele. */
async function carregar(id: string): Promise<AgendamentoCompleto> {
  const m = await membroOuErro();
  const ag = await agendamentoPorId(uuid.parse(id));
  if (!ag) throw new Error("Agendamento não encontrado.");
  if (m.papel !== "admin" && ag.profissional_id !== m.profissionalId) {
    throw new Error("Este agendamento é de outra profissional.");
  }
  return ag;
}

function atualizarTelas() {
  revalidatePath("/painel", "layout");
}

async function proteger<T extends Resposta>(fn: () => Promise<T>): Promise<Resposta> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Algo deu errado. Tente de novo." };
  }
}

/** Confirma o agendamento. Se havia valor a cobrar (sinal ou total), registra como recebido. */
export async function confirmarAgendamento(id: string): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    if (ag.status !== "aguardando_pagamento" && ag.status !== "pendente") {
      return { ok: false as const, erro: "Este agendamento já foi tratado." };
    }
    const cfg = await getConfig();
    const devido = calcularCobranca(ag.valor_total, ag.tipo_pagamento, cfg.sinal_percentual);
    const falta = Math.max(0, Math.round((devido - ag.valor_pago) * 100) / 100);
    if (falta > 0) {
      const r = await registrarRecebimento(ag.id, falta, "equipe");
      if (!r.ok) return { ok: false as const, erro: r.erro };
    } else {
      const { error } = await db().from("agendamentos").update({ status: "confirmado", expira_em: null }).eq("id", ag.id);
      if (error) return { ok: false as const, erro: error.message };
    }
    atualizarTelas();
    return { ok: true as const };
  });
}

/** Registra um valor recebido (por exemplo, o restante pago no dia). */
export async function receberValor(id: string, valor: number): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    const v = z.number().positive().max(100000).parse(valor);
    if (["cancelado", "expirado", "faltou"].includes(ag.status)) {
      return { ok: false as const, erro: "Este agendamento não está mais ativo." };
    }
    const r = await registrarRecebimento(ag.id, v, "equipe");
    if (!r.ok) return { ok: false as const, erro: r.erro };
    atualizarTelas();
    return { ok: true as const };
  });
}

export async function concluirAtendimento(id: string, receberRestante: boolean): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    if (!["confirmado", "pendente", "aguardando_pagamento"].includes(ag.status)) {
      return { ok: false as const, erro: "Este agendamento não pode ser concluído." };
    }
    if (ag.status !== "confirmado") {
      const c = await confirmarAgendamento(ag.id);
      if (!c.ok) return c;
    }
    const atual = (await agendamentoPorId(ag.id)) ?? ag;
    const falta = Math.max(0, Math.round((atual.valor_total - atual.valor_pago) * 100) / 100);
    if (receberRestante && falta > 0) {
      const r = await registrarRecebimento(ag.id, falta, "equipe");
      if (!r.ok) return { ok: false as const, erro: r.erro };
    }
    const { error } = await db().from("agendamentos").update({ status: "concluido" }).eq("id", ag.id);
    if (error) return { ok: false as const, erro: error.message };
    atualizarTelas();
    return { ok: true as const };
  });
}

export async function marcarFalta(id: string): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    const { error } = await db().from("agendamentos").update({ status: "faltou", expira_em: null }).eq("id", ag.id);
    if (error) return { ok: false as const, erro: error.message };
    atualizarTelas();
    return { ok: true as const };
  });
}

export async function cancelarPelaEquipe(id: string, reembolsada: boolean): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    const patch: Record<string, unknown> = { status: "cancelado", expira_em: null };
    if (reembolsada && ag.valor_pago > 0) patch.pagamento_status = "reembolsado";
    const { error } = await db().from("agendamentos").update(patch).eq("id", ag.id);
    if (error) return { ok: false as const, erro: error.message };
    await seguro(() =>
      avisarCliente(ag.id, {
        titulo: "Horário cancelado",
        corpo: `${ag.servico.nome} de ${dataCurta(ag.data)} às ${ag.inicio} foi cancelado. Fale com a gente para remarcar.`,
        url: `/reserva/${ag.token_gerenciar}`,
        tag: `ag-${ag.id}`,
      }),
    );
    atualizarTelas();
    return { ok: true as const };
  });
}

export async function salvarObservacao(id: string, texto: string): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    const t = z.string().max(600).parse(texto).trim();
    const { error } = await db().from("agendamentos").update({ observacoes: t || null }).eq("id", ag.id);
    if (error) return { ok: false as const, erro: error.message };
    atualizarTelas();
    return { ok: true as const };
  });
}

/* ---------- remarcar pela equipe (ignora antecedência e prazo de cancelamento) ---------- */

const diasSchema = z.object({ id: uuid, ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) });

export async function diasLivresParaRemarcar(entrada: z.input<typeof diasSchema>): Promise<string[]> {
  const p = diasSchema.parse(entrada);
  const ag = await carregar(p.id);
  const oferta = await resolverOferta(ag.servico_id, ag.variacao_id);
  if (!oferta) return [];
  await expirarVencidas();
  const mm = String(p.mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate();
  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: ag.profissional_id,
    de: `${p.ano}-${mm}-01`,
    ate: `${p.ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
    ignorarAgendamentoId: ag.id,
    ignorarAntecedencia: true,
  });
  return Object.entries(mapa)
    .filter(([, h]) => Object.keys(h).length > 0)
    .map(([d]) => d)
    .sort();
}

export async function horasLivresParaRemarcar(entrada: { id: string; data: string }): Promise<string[]> {
  const id = uuid.parse(entrada.id);
  if (!dataValida(entrada.data)) return [];
  const ag = await carregar(id);
  const oferta = await resolverOferta(ag.servico_id, ag.variacao_id);
  if (!oferta) return [];
  await expirarVencidas();
  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: ag.profissional_id,
    de: entrada.data,
    ate: entrada.data,
    ignorarAgendamentoId: ag.id,
    ignorarAntecedencia: true,
  });
  return Object.keys(mapa[entrada.data] ?? {}).sort();
}

export async function remarcarPelaEquipe(id: string, data: string, hora: string): Promise<Resposta> {
  return proteger(async () => {
    const ag = await carregar(id);
    if (!dataValida(data) || !/^\d{2}:\d{2}$/.test(hora)) return { ok: false as const, erro: "Data ou horário inválido." };
    if (!["aguardando_pagamento", "pendente", "confirmado"].includes(ag.status)) {
      return { ok: false as const, erro: "Este agendamento não pode mais ser remarcado." };
    }
    const livres = await horasLivresParaRemarcar({ id: ag.id, data });
    if (!livres.includes(hora)) return { ok: false as const, erro: "Esse horário não está mais livre. Escolha outro." };
    const { error } = await db()
      .from("agendamentos")
      .update({ data, inicio: hora, fim: minParaHhmm(hhmmParaMin(hora) + ag.duracao_total) })
      .eq("id", ag.id);
    if (error) {
      if (error.code === "23P01") return { ok: false as const, erro: "Esse horário acabou de ser ocupado. Escolha outro." };
      return { ok: false as const, erro: error.message };
    }
    await seguro(() =>
      avisarCliente(ag.id, {
        titulo: "Horário alterado",
        corpo: `${ag.servico.nome} agora é em ${dataCurta(data)} às ${hora}.`,
        url: `/reserva/${ag.token_gerenciar}`,
        tag: `ag-${ag.id}`,
      }),
    );
    atualizarTelas();
    return { ok: true as const };
  });
}
