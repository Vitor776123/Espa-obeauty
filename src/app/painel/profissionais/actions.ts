"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";
import { hhmmParaMin } from "@/lib/tempo";

export type Resp<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const hora = z.string().regex(/^\d{2}:\d{2}$/);

const schema = z.object({
  id: z.uuid().nullable(),
  nome: z.string().trim().min(2, "Informe o nome.").max(80),
  bio: z.string().trim().max(400).nullable(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  ativo: z.boolean(),
  ordem: z.number().int().min(0).max(999),
  servicos: z.array(z.uuid()).max(200),
  horarios: z
    .array(
      z.object({
        dia: z.number().int().min(0).max(6),
        trabalha: z.boolean(),
        inicio: hora,
        fim: hora,
        almocoInicio: hora.nullable(),
        almocoFim: hora.nullable(),
      }),
    )
    .length(7),
});

export type EntradaProfissional = z.input<typeof schema>;
const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export async function salvarProfissional(entrada: EntradaProfissional): Promise<Resp<{ id: string }>> {
  try {
    await membroOuErro({ admin: true });
    const parsed = schema.safeParse(entrada);
    if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os campos." };
    const v = parsed.data;

    for (const h of v.horarios) {
      if (!h.trabalha) continue;
      const nome = NOMES[h.dia];
      if (hhmmParaMin(h.fim) <= hhmmParaMin(h.inicio)) return { ok: false, erro: `Em ${nome}, o fim precisa ser depois do início.` };
      if (h.almocoInicio || h.almocoFim) {
        if (!h.almocoInicio || !h.almocoFim) return { ok: false, erro: `Em ${nome}, preencha o início e o fim do almoço (ou deixe os dois vazios).` };
        const ai = hhmmParaMin(h.almocoInicio);
        const af = hhmmParaMin(h.almocoFim);
        if (af <= ai || ai < hhmmParaMin(h.inicio) || af > hhmmParaMin(h.fim)) {
          return { ok: false, erro: `Em ${nome}, o almoço precisa estar dentro do expediente.` };
        }
      }
    }

    const campos = { nome: v.nome, bio: v.bio || null, cor: v.cor, ativo: v.ativo, ordem: v.ordem };
    let id = v.id;
    if (id) {
      const { error } = await db().from("profissionais").update(campos).eq("id", id);
      if (error) return { ok: false, erro: error.message };
    } else {
      const { data, error } = await db().from("profissionais").insert(campos).select("id").single();
      if (error) return { ok: false, erro: error.message };
      id = data.id as string;
    }

    await db().from("horarios_trabalho").delete().eq("profissional_id", id);
    const dias = v.horarios
      .filter((h) => h.trabalha)
      .map((h) => ({
        profissional_id: id,
        dia_semana: h.dia,
        inicio: h.inicio,
        fim: h.fim,
        almoco_inicio: h.almocoInicio,
        almoco_fim: h.almocoFim,
      }));
    if (dias.length) {
      const { error } = await db().from("horarios_trabalho").insert(dias);
      if (error) return { ok: false, erro: error.message };
    }

    await db().from("servico_profissionais").delete().eq("profissional_id", id);
    if (v.servicos.length) {
      const { error } = await db()
        .from("servico_profissionais")
        .insert(v.servicos.map((s) => ({ servico_id: s, profissional_id: id })));
      if (error) return { ok: false, erro: error.message };
    }

    revalidatePath("/", "layout");
    return { ok: true, id: id! };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
}

export async function excluirProfissional(id: string): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const { error } = await db().from("profissionais").delete().eq("id", z.uuid().parse(id));
    if (error) {
      if (error.code === "23503") return { ok: false, erro: "Esta profissional já tem agendamentos. Desative-a em vez de excluir." };
      return { ok: false, erro: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível excluir." };
  }
}
