"use server";

import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { agendamentoPorId, calcularDisponibilidade, expirarVencidas, reservar, resolverOferta } from "@/lib/reservas";
import { criarCobrancaPix } from "@/lib/pagamentos";
import { mpAtivo } from "@/lib/mercadopago";
import { agoraSP, dataCurta, dataValida, formatBRL, somarDias } from "@/lib/tempo";
import { getConfig, listarProfissionais, listarServicos } from "@/lib/dados";
import type { Tamanho } from "@/lib/tipos";
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


export type ServicoChat = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  descricao: string;
  temTamanho: boolean;
  preco: number;
  duracao: number;
  variacoes: { id: string; tamanho: Tamanho; preco: number; duracao: number }[];
  profissionais: string[];
};

export type DadosChat = {
  servicos: ServicoChat[];
  profissionais: { id: string; nome: string }[];
  hoje: string;
  maxData: string;
  sinalPct: number;
  holdMinutos: number;
  exigeEmail: boolean;
  whatsapp: string | null;
};

/** Tudo o que o chat precisa para conversar. Vem por aqui para a página abrir na hora e o chat carregar em seguida. */
export async function carregarDadosChat(): Promise<DadosChat> {
  const [servicos, profs, cfg] = await Promise.all([listarServicos(), listarProfissionais(), getConfig()]);
  const hoje = agoraSP().data;
  return {
    servicos: servicos
      .filter((s) => (s.tem_tamanho ? s.variacoes.length > 0 : s.duracao_min > 0))
      .map((s) => {
        const precos = s.tem_tamanho ? s.variacoes.map((v) => v.preco) : [s.preco_base];
        return {
          id: s.id,
          slug: s.slug,
          nome: s.nome,
          categoria: s.categoria,
          descricao: s.descricao ?? "",
          temTamanho: s.tem_tamanho,
          preco: Math.min(...precos),
          duracao: s.duracao_min,
          variacoes: s.variacoes.map((v) => ({ id: v.id, tamanho: v.tamanho, preco: v.preco, duracao: v.duracao_min })),
          profissionais: s.profissionais,
        };
      }),
    profissionais: profs.map((p) => ({ id: p.id, nome: p.nome })),
    hoje,
    maxData: somarDias(hoje, cfg.janela_dias),
    sinalPct: cfg.sinal_percentual,
    holdMinutos: cfg.hold_minutos,
    exigeEmail: mpAtivo(),
    whatsapp: cfg.whatsapp,
  };
}
