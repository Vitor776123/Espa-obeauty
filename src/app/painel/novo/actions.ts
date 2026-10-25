"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";
import { mpAtivo } from "@/lib/mercadopago";
import { criarCobrancaPix, registrarRecebimento } from "@/lib/pagamentos";
import { agendamentoPorId, calcularDisponibilidade, expirarVencidas, normalizarTelefone, reservar, resolverOferta } from "@/lib/reservas";
import { dataValida } from "@/lib/tempo";

const uuid = z.uuid();
const oferta = { servicoId: uuid, variacaoId: uuid.nullable(), profissionalId: uuid.nullable() };

async function profissionalPermitida(pedida: string | null): Promise<string | null> {
  const m = await membroOuErro();
  if (m.papel === "admin") return pedida;
  if (!m.profissionalId) throw new Error("Seu acesso não está ligado a uma profissional. Peça para a administradora ajustar.");
  return m.profissionalId;
}

const diasSchema = z.object({ ...oferta, ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) });
const horasSchema = z.object({ ...oferta, data: z.string().refine(dataValida) });

export async function diasLivresEquipe(entrada: z.input<typeof diasSchema>): Promise<string[]> {
  const p = diasSchema.parse(entrada);
  const prof = await profissionalPermitida(p.profissionalId);
  const o = await resolverOferta(p.servicoId, p.variacaoId);
  if (!o) return [];
  await expirarVencidas();
  const mm = String(p.mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate();
  const mapa = await calcularDisponibilidade({
    oferta: o,
    profissionalId: prof,
    de: `${p.ano}-${mm}-01`,
    ate: `${p.ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
    ignorarAntecedencia: true,
  });
  return Object.entries(mapa)
    .filter(([, h]) => Object.keys(h).length > 0)
    .map(([d]) => d)
    .sort();
}

export async function horasLivresEquipe(entrada: z.input<typeof horasSchema>): Promise<string[]> {
  const p = horasSchema.parse(entrada);
  const prof = await profissionalPermitida(p.profissionalId);
  const o = await resolverOferta(p.servicoId, p.variacaoId);
  if (!o) return [];
  await expirarVencidas();
  const mapa = await calcularDisponibilidade({ oferta: o, profissionalId: prof, de: p.data, ate: p.data, ignorarAntecedencia: true });
  return Object.keys(mapa[p.data] ?? {}).sort();
}

export async function buscarClientePorTelefone(telefone: string): Promise<{ nome: string; email: string | null } | null> {
  await membroOuErro();
  const t = normalizarTelefone(telefone);
  if (!t) return null;
  const { data } = await db().from("clientes").select("nome, email").eq("telefone", t).maybeSingle();
  return data ? { nome: data.nome, email: data.email } : null;
}

/** Como a cliente vai pagar */
const FORMAS = ["no_local", "sinal_recebido", "total_recebido", "cobrar_pix"] as const;

const novoSchema = z.object({
  ...oferta,
  data: z.string().refine(dataValida),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  nome: z.string().trim().min(2, "Informe o nome da cliente.").max(120),
  telefone: z.string().min(8).max(25),
  email: z.union([z.literal(""), z.email("E-mail inválido.")]).optional(),
  forma: z.enum(FORMAS),
  observacoes: z.string().max(600).optional(),
});

export type RespostaNovo = { ok: true; token: string; id: string; cobrarPix: boolean } | { ok: false; erro: string };

export async function criarPelaEquipe(entrada: z.input<typeof novoSchema>): Promise<RespostaNovo> {
  try {
    const parsed = novoSchema.safeParse(entrada);
    if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os dados." };
    const p = parsed.data;
    const prof = await profissionalPermitida(p.profissionalId);

    if (p.forma === "cobrar_pix" && mpAtivo() && !p.email) {
      return { ok: false, erro: "Para gerar o PIX automático, informe o e-mail da cliente." };
    }

    const tipo = p.forma === "no_local" ? "no_local" : p.forma === "total_recebido" ? "total" : "sinal";
    const r = await reservar({
      servicoId: p.servicoId,
      variacaoId: p.variacaoId,
      profissionalId: prof,
      data: p.data,
      hora: p.hora,
      cliente: { nome: p.nome, telefone: p.telefone, email: p.email || null },
      tipoPagamento: tipo,
      origem: "equipe",
      observacoes: p.observacoes?.trim() || null,
      ignorarAntecedencia: true,
    });
    if (!r.ok) return r;

    const id = r.agendamento.id;
    if ((p.forma === "sinal_recebido" || p.forma === "total_recebido") && r.valorACobrar > 0) {
      const rec = await registrarRecebimento(id, r.valorACobrar, "equipe");
      if (!rec.ok) return { ok: false, erro: rec.erro };
    }
    if (p.forma === "cobrar_pix" && mpAtivo() && r.valorACobrar > 0) {
      try {
        const completo = await agendamentoPorId(id);
        if (completo) await criarCobrancaPix(completo);
      } catch (e) {
        console.error("[pix equipe]", e);
        await db().from("agendamentos").update({ status: "cancelado", expira_em: null }).eq("id", id);
        return { ok: false, erro: "Não foi possível gerar o PIX agora. Tente de novo." };
      }
    }
    revalidatePath("/painel", "layout");
    return { ok: true, token: r.agendamento.token_gerenciar, id, cobrarPix: p.forma === "cobrar_pix" };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Algo deu errado. Tente de novo." };
  }
}
