"use server";

import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { agendamentoPorId, calcularDisponibilidade, expirarVencidas, reservar, resolverOferta } from "@/lib/reservas";
import { criarCobrancaPix } from "@/lib/pagamentos";
import { mpAtivo } from "@/lib/mercadopago";
import { dataCurta, dataValida, formatBRL } from "@/lib/tempo";
import { avisarEquipe, seguro } from "@/lib/push";

const id = z.uuid();
const base = {
  servicoId: id,
  variacaoId: id.nullable(),
  profissionalId: id.nullable(),
};

const diasSchema = z.object({ ...base, ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) });
const horasSchema = z.object({ ...base, data: z.string().refine(dataValida) });

export async function buscarDiasLivres(entrada: z.input<typeof diasSchema>): Promise<string[]> {
  const p = diasSchema.parse(entrada);
  const oferta = await resolverOferta(p.servicoId, p.variacaoId);
  if (!oferta) return [];
  await expirarVencidas();
  const mm = String(p.mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate();
  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: p.profissionalId,
    de: `${p.ano}-${mm}-01`,
    ate: `${p.ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
  });
  return Object.entries(mapa)
    .filter(([, horas]) => Object.keys(horas).length > 0)
    .map(([dia]) => dia)
    .sort();
}

export async function buscarHorasLivres(entrada: z.input<typeof horasSchema>): Promise<string[]> {
  const p = horasSchema.parse(entrada);
  const oferta = await resolverOferta(p.servicoId, p.variacaoId);
  if (!oferta) return [];
  await expirarVencidas();
  const mapa = await calcularDisponibilidade({ oferta, profissionalId: p.profissionalId, de: p.data, ate: p.data });
  return Object.keys(mapa[p.data] ?? {}).sort();
}

const reservaSchema = z.object({
  ...base,
  data: z.string().refine(dataValida),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  nome: z.string().trim().min(2, "Informe seu nome.").max(120),
  telefone: z.string().min(8).max(25),
  email: z.union([z.literal(""), z.email("E-mail inválido.")]).optional(),
  tipoPagamento: z.enum(["sinal", "total"]),
});

export type RespostaReserva = { ok: true; token: string } | { ok: false; erro: string };

export async function criarReservaPublica(entrada: z.input<typeof reservaSchema>): Promise<RespostaReserva> {
  const parsed = reservaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  const p = parsed.data;

  if (mpAtivo() && !p.email) return { ok: false, erro: "Informe seu e-mail: ele é exigido para gerar o PIX." };

  const r = await reservar({
    servicoId: p.servicoId,
    variacaoId: p.variacaoId,
    profissionalId: p.profissionalId,
    data: p.data,
    hora: p.hora,
    cliente: { nome: p.nome, telefone: p.telefone, email: p.email || null },
    tipoPagamento: p.tipoPagamento,
    origem: "site",
  });
  if (!r.ok) return r;

  // Com Mercado Pago ativo, gera o PIX agora; se falhar, libera o horário.
  if (mpAtivo() && r.valorACobrar > 0) {
    try {
      const completo = await agendamentoPorId(r.agendamento.id);
      if (!completo) throw new Error("Reserva não encontrada após criar.");
      await criarCobrancaPix(completo);
    } catch (e) {
      console.error("[pix]", e);
      await db().from("agendamentos").update({ status: "cancelado", expira_em: null }).eq("id", r.agendamento.id);
      return { ok: false, erro: "Não conseguimos gerar o PIX agora. Tente de novo em instantes." };
    }
  }
  await seguro(() =>
    avisarEquipe({
      titulo: "Nova reserva",
      corpo: `${p.nome} · ${dataCurta(p.data)} ${p.hora}${r.valorACobrar > 0 ? ` · aguardando o PIX de ${formatBRL(r.valorACobrar)}` : ""}`,
      url: "/painel/agenda",
      tag: `reserva-${r.agendamento.id}`,
    }),
  );
  return { ok: true, token: r.agendamento.token_gerenciar };
}
