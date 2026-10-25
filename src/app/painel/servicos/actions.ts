"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";

export type Resp<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const BUCKET = "beauty-servicos";

function slugificar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function slugLivre(nome: string, ignorarId?: string) {
  const base = slugificar(nome) || "servico";
  for (let i = 0; i < 20; i++) {
    const candidato = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await db().from("servicos").select("id").eq("slug", candidato).maybeSingle();
    if (!data || data.id === ignorarId) return candidato;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}

const dinheiro = z.number("Informe um valor válido.").min(0, "O preço não pode ser negativo.").max(100000, "Preço alto demais.");
const minutos = z.number("Informe a duração em minutos.").int().min(5, "A duração mínima é de 5 minutos.").max(1440, "A duração máxima é de 24 horas.");

const servicoSchema = z
  .object({
    id: z.uuid().nullable(),
    nome: z.string().trim().min(2, "Informe o nome do serviço.").max(120, "Nome longo demais."),
    categoria: z.string().trim().min(2, "Informe a categoria.").max(80, "Categoria longa demais."),
    descricao: z.string().trim().max(300, "A descrição curta pode ter até 300 caracteres.").nullable(),
    descricaoLonga: z.string().trim().max(2000, "A descrição completa pode ter até 2000 caracteres.").nullable(),
    fotoUrl: z.string().url("Endereço da foto inválido.").max(1000, "Endereço da foto longo demais.").nullable(),
    passos: z.array(z.string().trim().min(1).max(300, "Cada passo pode ter até 300 caracteres.")).max(20, "No máximo 20 passos."),
    temTamanho: z.boolean(),
    preco: dinheiro,
    duracao: minutos.nullable(),
    variacoes: z
      .array(z.object({ tamanho: z.enum(["curto", "medio", "longo"]), preco: dinheiro, duracao: minutos }))
      .max(3),
    ativo: z.boolean(),
    ordem: z.number().int().min(0).max(9999),
    profissionais: z.array(z.uuid()).max(50),
  })
  .superRefine((v, ctx) => {
    if (v.temTamanho && v.variacoes.length === 0) {
      ctx.addIssue({ code: "custom", message: "Informe pelo menos um tamanho de cabelo com preço e duração.", path: ["variacoes"] });
    }
    if (!v.temTamanho && !v.duracao) {
      ctx.addIssue({ code: "custom", message: "Informe a duração do serviço.", path: ["duracao"] });
    }
  });

export type EntradaServico = z.input<typeof servicoSchema>;

export async function salvarServico(entrada: EntradaServico): Promise<Resp<{ id: string }>> {
  try {
    await membroOuErro({ admin: true });
    const parsed = servicoSchema.safeParse(entrada);
    if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os campos." };
    const v = parsed.data;

    const precoBase = v.temTamanho ? Math.min(...v.variacoes.map((x) => x.preco)) : v.preco;
    const duracaoBase = v.temTamanho ? Math.min(...v.variacoes.map((x) => x.duracao)) : (v.duracao ?? 30);
    const campos = {
      nome: v.nome,
      categoria: v.categoria,
      descricao: v.descricao || null,
      descricao_longa: v.descricaoLonga || null,
      foto_url: v.fotoUrl,
      passos: v.passos,
      preco_base: precoBase,
      duracao_min: duracaoBase,
      tem_tamanho: v.temTamanho,
      ativo: v.ativo,
      ordem: v.ordem,
    };

    let id = v.id;
    if (id) {
      const { error } = await db().from("servicos").update(campos).eq("id", id);
      if (error) return { ok: false, erro: error.message };
    } else {
      const slug = await slugLivre(v.nome);
      const { data, error } = await db().from("servicos").insert({ ...campos, slug }).select("id").single();
      if (error) return { ok: false, erro: error.message };
      id = data.id as string;
    }

    // tamanhos
    const { data: atuais } = await db().from("variacoes_servico").select("id, tamanho").eq("servico_id", id);
    const novos = v.temTamanho ? v.variacoes : [];
    for (const n of novos) {
      const ja = atuais?.find((a) => a.tamanho === n.tamanho);
      const linha = { preco: n.preco, duracao_min: n.duracao };
      const r = ja
        ? await db().from("variacoes_servico").update(linha).eq("id", ja.id)
        : await db().from("variacoes_servico").insert({ ...linha, servico_id: id, tamanho: n.tamanho });
      if (r.error) return { ok: false, erro: r.error.message };
    }
    for (const a of atuais ?? []) {
      if (novos.some((n) => n.tamanho === a.tamanho)) continue;
      const r = await db().from("variacoes_servico").delete().eq("id", a.id);
      if (r.error) {
        return {
          ok: false,
          erro: "Já existem agendamentos com um tamanho que você removeu. Mantenha o tamanho e desative o serviço, se precisar.",
        };
      }
    }

    // quem faz
    await db().from("servico_profissionais").delete().eq("servico_id", id);
    if (v.profissionais.length) {
      const { error } = await db()
        .from("servico_profissionais")
        .insert(v.profissionais.map((p) => ({ servico_id: id, profissional_id: p })));
      if (error) return { ok: false, erro: error.message };
    }

    revalidatePath("/", "layout");
    return { ok: true, id: id! };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
}

export async function alternarServico(id: string, ativo: boolean): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const { error } = await db().from("servicos").update({ ativo }).eq("id", z.uuid().parse(id));
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível alterar." };
  }
}

export async function excluirServico(id: string): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const { error } = await db().from("servicos").delete().eq("id", z.uuid().parse(id));
    if (error) {
      if (error.code === "23503") return { ok: false, erro: "Este serviço já tem agendamentos. Desative-o em vez de excluir." };
      return { ok: false, erro: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível excluir." };
  }
}

/** A foto chega já reduzida pelo navegador (JPEG/WebP até ~1 MB). */
export async function enviarFotoServico(form: FormData): Promise<Resp<{ url: string }>> {
  try {
    await membroOuErro({ admin: true });
    const arquivo = form.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha uma imagem." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) return { ok: false, erro: "Use uma imagem JPG, PNG ou WebP." };
    if (arquivo.size > 3 * 1024 * 1024) return { ok: false, erro: "A imagem é grande demais (máximo 3 MB)." };
    const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const caminho = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
    const { error } = await db().storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: "31536000" });
    if (error) return { ok: false, erro: `Falha no envio da foto: ${error.message}` };
    const { data } = db().storage.from(BUCKET).getPublicUrl(caminho);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível enviar a foto." };
  }
}
