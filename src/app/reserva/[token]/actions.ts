"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/admin";
import {
  agendamentoPorToken,
  calcularDisponibilidade,
  cancelarPorCliente,
  expirarVencidas,
  remarcarPorCliente,
  resolverOferta,
} from "@/lib/reservas";
import { avisarEquipe, seguro } from "@/lib/push";
import { dataCurta, dataValida } from "@/lib/tempo";

const token = z.string().regex(/^[a-f0-9]{36}$/);

export async function statusDaReserva(t: string): Promise<{ status: string; pagamento: string } | null> {
  const ag = await agendamentoPorToken(token.parse(t));
  return ag ? { status: ag.status, pagamento: ag.pagamento_status } : null;
}

/** PIX manual: a cliente avisa que pagou; a equipe confere no painel. */
export async function avisarPagamentoManual(t: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await agendamentoPorToken(token.parse(t));
  if (!ag) return { ok: false, erro: "Reserva não encontrada." };
  if (ag.status !== "aguardando_pagamento") return { ok: true };
  const { error } = await db()
    .from("agendamentos")
    .update({ status: "pendente", expira_em: null })
    .eq("id", ag.id)
    .eq("status", "aguardando_pagamento");
  if (error) return { ok: false, erro: "Não foi possível registrar. Tente de novo." };
  await seguro(() =>
    avisarEquipe({
      titulo: "Pagamento para conferir",
      corpo: `${ag.cliente.nome} avisou que pagou · ${ag.servico.nome} · ${dataCurta(ag.data)} ${ag.inicio}`,
      url: "/painel/agenda",
      tag: `conferir-${ag.id}`,
    }),
  );
  revalidatePath(`/reserva/${t}`);
  return { ok: true };
}

const diasSchema = z.object({ token, ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) });
const horasSchema = z.object({ token, data: z.string().refine(dataValida) });

export async function diasParaRemarcar(entrada: z.input<typeof diasSchema>): Promise<string[]> {
  const p = diasSchema.parse(entrada);
  const ag = await agendamentoPorToken(p.token);
  if (!ag) return [];
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
  });
  return Object.entries(mapa)
    .filter(([, h]) => Object.keys(h).length)
    .map(([d]) => d)
    .sort();
}

export async function horasParaRemarcar(entrada: z.input<typeof horasSchema>): Promise<string[]> {
  const p = horasSchema.parse(entrada);
  const ag = await agendamentoPorToken(p.token);
  if (!ag) return [];
  const oferta = await resolverOferta(ag.servico_id, ag.variacao_id);
  if (!oferta) return [];
  await expirarVencidas();
  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: ag.profissional_id,
    de: p.data,
    ate: p.data,
    ignorarAgendamentoId: ag.id,
  });
  return Object.keys(mapa[p.data] ?? {}).sort();
}

export async function remarcarReserva(t: string, data: string, hora: string): Promise<{ ok: boolean; erro?: string }> {
  const r = await remarcarPorCliente(token.parse(t), data, hora);
  if (r.ok) {
    const ag = await agendamentoPorToken(t);
    if (ag) {
      await seguro(() =>
        avisarEquipe({
          titulo: "Reserva remarcada",
          corpo: `${ag.cliente.nome} · ${ag.servico.nome} · agora ${dataCurta(ag.data)} às ${ag.inicio}`,
          url: "/painel/agenda",
          tag: `remarcou-${ag.id}`,
        }),
      );
    }
    revalidatePath(`/reserva/${t}`);
  }
  return r;
}

export async function cancelarReserva(t: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await agendamentoPorToken(token.parse(t));
  const r = await cancelarPorCliente(token.parse(t));
  if (r.ok && ag) {
    await seguro(() =>
      avisarEquipe({
        titulo: "Reserva cancelada",
        corpo: `${ag.cliente.nome} cancelou ${ag.servico.nome} de ${dataCurta(ag.data)} às ${ag.inicio}`,
        url: "/painel/agenda",
        tag: `cancelou-${ag.id}`,
      }),
    );
    revalidatePath(`/reserva/${t}`);
  }
  return r;
}
