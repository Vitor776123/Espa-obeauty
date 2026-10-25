import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Membro } from "@/lib/auth";
import { normalizarAgendamento } from "@/lib/reservas";
import { somarDias } from "@/lib/tempo";
import type { AgendamentoCompleto, StatusAgendamento } from "@/lib/tipos";

const NADA = "00000000-0000-0000-0000-000000000000";

/** null = vê tudo (administradora); id = só a própria agenda. */
export function escopoDe(m: Membro): string | null {
  if (m.papel === "admin") return null;
  return m.profissionalId ?? NADA;
}

const SELECT_COMPLETO =
  "*, cliente:clientes(id, nome, telefone, email), servico:servicos(id, nome), variacao:variacoes_servico(tamanho), profissional:profissionais(id, nome, cor)";

export async function listarAgendamentos(p: {
  de: string;
  ate: string;
  escopo: string | null;
  status?: StatusAgendamento[];
}): Promise<AgendamentoCompleto[]> {
  let q = db().from("agendamentos").select(SELECT_COMPLETO).gte("data", p.de).lte("data", p.ate).order("data").order("inicio");
  if (p.escopo) q = q.eq("profissional_id", p.escopo);
  if (p.status) q = q.in("status", p.status);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao listar agendamentos: ${error.message}`);
  return (data ?? []).map((l) => normalizarAgendamento(l) as AgendamentoCompleto);
}

const CONTA: StatusAgendamento[] = ["confirmado", "pendente", "concluido"];

export type Metricas = {
  atendimentos: number;
  previsto: number;
  recebido: number;
  aReceber: number;
  aguardando: number;
};

export function calcularMetricas(ags: AgendamentoCompleto[]): Metricas {
  const validos = ags.filter((a) => CONTA.includes(a.status));
  const previsto = validos.reduce((s, a) => s + a.valor_total, 0);
  const recebido = validos.reduce((s, a) => s + a.valor_pago, 0);
  return {
    atendimentos: validos.length,
    previsto,
    recebido,
    aReceber: Math.max(0, previsto - recebido),
    aguardando: ags.filter((a) => a.status === "aguardando_pagamento" || a.status === "pendente").length,
  };
}

export async function proximosDias(hoje: string, dias: number, escopo: string | null) {
  const ags = await listarAgendamentos({ de: hoje, ate: somarDias(hoje, dias - 1), escopo, status: CONTA });
  const lista: { data: string; total: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const d = somarDias(hoje, i);
    lista.push({ data: d, total: ags.filter((a) => a.data === d).length });
  }
  return lista;
}

export type Bloqueio = {
  id: string;
  profissional_id: string | null;
  data: string;
  inicio: string;
  fim: string;
  motivo: string | null;
};

export async function listarBloqueios(p: { de: string; ate: string; escopo: string | null }): Promise<Bloqueio[]> {
  let q = db().from("bloqueios").select("*").gte("data", p.de).lte("data", p.ate).order("data").order("inicio");
  // profissional vê os dela e os que valem para todas
  if (p.escopo) q = q.or(`profissional_id.eq.${p.escopo},profissional_id.is.null`);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao listar bloqueios: ${error.message}`);
  return (data ?? []).map((b) => ({ ...b, inicio: String(b.inicio).slice(0, 5), fim: String(b.fim).slice(0, 5) })) as Bloqueio[];
}
