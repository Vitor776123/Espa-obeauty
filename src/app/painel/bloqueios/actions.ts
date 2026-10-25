"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";
import { dataValida, hhmmParaMin, somarDias } from "@/lib/tempo";
import { STATUS_ATIVOS } from "@/lib/tipos";

const hora = z.string().regex(/^\d{2}:\d{2}$/);
const schema = z.object({
  profissionalId: z.uuid().nullable(),
  de: z.string().refine(dataValida, "Data inicial inválida."),
  ate: z.string().refine(dataValida, "Data final inválida."),
  inicio: hora,
  fim: hora,
  motivo: z.string().trim().max(120).nullable(),
});

export type RespBloqueio =
  | { ok: true; criados: number; conflitos: { cliente: string; data: string; inicio: string }[] }
  | { ok: false; erro: string };

export async function criarBloqueio(entrada: z.input<typeof schema>): Promise<RespBloqueio> {
  try {
    const m = await membroOuErro();
    const parsed = schema.safeParse(entrada);
    if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os campos." };
    const v = parsed.data;

    // profissional só bloqueia a própria agenda
    const profissionalId = m.papel === "admin" ? v.profissionalId : m.profissionalId;
    if (m.papel !== "admin" && !profissionalId) return { ok: false, erro: "Seu acesso não está ligado a uma profissional." };

    if (v.ate < v.de) return { ok: false, erro: "A data final não pode ser antes da inicial." };
    if (hhmmParaMin(v.fim) <= hhmmParaMin(v.inicio)) return { ok: false, erro: "O horário final precisa ser depois do inicial." };

    const linhas: { profissional_id: string | null; data: string; inicio: string; fim: string; motivo: string | null }[] = [];
    for (let d = v.de; d <= v.ate; d = somarDias(d, 1)) {
      linhas.push({ profissional_id: profissionalId, data: d, inicio: v.inicio, fim: v.fim, motivo: v.motivo || null });
      if (linhas.length > 62) return { ok: false, erro: "O período pode ter no máximo 60 dias." };
    }

    const { error } = await db().from("bloqueios").insert(linhas);
    if (error) return { ok: false, erro: error.message };

    // avisa sobre agendamentos que já estavam dentro do bloqueio
    let q = db()
      .from("agendamentos")
      .select("data, inicio, fim, cliente:clientes(nome)")
      .gte("data", v.de)
      .lte("data", v.ate)
      .in("status", STATUS_ATIVOS);
    if (profissionalId) q = q.eq("profissional_id", profissionalId);
    const { data: ags } = await q;
    const ini = hhmmParaMin(v.inicio);
    const fim = hhmmParaMin(v.fim);
    const conflitos = (ags ?? [])
      .filter((a) => hhmmParaMin(String(a.inicio).slice(0, 5)) < fim && hhmmParaMin(String(a.fim).slice(0, 5)) > ini)
      .map((a) => ({
        cliente: (a.cliente as unknown as { nome: string } | null)?.nome ?? "Cliente",
        data: a.data as string,
        inicio: String(a.inicio).slice(0, 5),
      }));

    revalidatePath("/painel", "layout");
    return { ok: true, criados: linhas.length, conflitos };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível bloquear." };
  }
}

export async function removerBloqueio(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const m = await membroOuErro();
    const bid = z.uuid().parse(id);
    const { data: b } = await db().from("bloqueios").select("profissional_id").eq("id", bid).maybeSingle();
    if (!b) return { ok: false, erro: "Bloqueio não encontrado." };
    if (m.papel !== "admin" && b.profissional_id !== m.profissionalId) {
      return { ok: false, erro: "Só a administradora remove bloqueios que valem para todas." };
    }
    const { error } = await db().from("bloqueios").delete().eq("id", bid);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/painel", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível remover." };
  }
}
