"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { membroOuErro } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/reservas";

export type Resp = { ok: true; aviso?: string } | { ok: false; erro: string };

const texto = (max: number) => z.string().trim().max(max);

const schema = z.object({
  nome_salao: texto(80).min(2, "Informe o nome do salão."),
  responsavel: texto(80).min(2, "Informe o nome da responsável."),
  whatsapp: texto(30),
  instagram: texto(80),
  endereco: texto(200),
  chave_pix: texto(120),
  pix_favorecido: texto(80),
  sinal_percentual: z.number().min(0, "O sinal não pode ser negativo.").max(100, "O sinal vai até 100%."),
  hold_minutos: z.number().int().min(5, "Segurar o horário por pelo menos 5 minutos.").max(240),
  slot_min: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  antecedencia_min_horas: z.number().int().min(0).max(72),
  limite_cancelamento_horas: z.number().int().min(0).max(168),
  janela_dias: z.number().int().min(7, "A janela precisa ter pelo menos 7 dias.").max(365),
});

export type EntradaConfig = z.input<typeof schema>;

export async function salvarConfiguracoes(entrada: EntradaConfig): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const p = schema.safeParse(entrada);
    if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Confira os campos." };
    const v = p.data;
    let whatsapp: string | null = null;
    if (v.whatsapp) {
      whatsapp = normalizarTelefone(v.whatsapp);
      if (!whatsapp) return { ok: false, erro: "WhatsApp inválido. Use o DDD e o número." };
    }
    const instagram = v.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "") || null;
    const { error } = await db()
      .from("configuracoes")
      .update({
        nome_salao: v.nome_salao,
        responsavel: v.responsavel,
        whatsapp,
        instagram,
        endereco: v.endereco || null,
        chave_pix: v.chave_pix || null,
        pix_favorecido: v.pix_favorecido || null,
        sinal_percentual: v.sinal_percentual,
        hold_minutos: v.hold_minutos,
        slot_min: v.slot_min,
        antecedencia_min_horas: v.antecedencia_min_horas,
        limite_cancelamento_horas: v.limite_cancelamento_horas,
        janela_dias: v.janela_dias,
      })
      .eq("id", 1);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
}

/* ---------------- equipe ---------------- */

const equipeSchema = z.object({
  nome: texto(80).min(2, "Informe o nome."),
  email: z.email("E-mail inválido.").max(160),
  senha: z.string().max(72),
  papel: z.enum(["admin", "profissional"]),
  profissionalId: z.uuid().nullable(),
});

async function acharUsuarioPorEmail(email: string) {
  for (let pagina = 1; pagina <= 25; pagina++) {
    const { data, error } = await db().auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function criarAcessoEquipe(entrada: z.input<typeof equipeSchema>): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const p = equipeSchema.safeParse(entrada);
    if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Confira os campos." };
    const v = p.data;
    if (v.papel === "profissional" && !v.profissionalId) return { ok: false, erro: "Escolha a profissional que essa pessoa representa." };
    const email = v.email.toLowerCase();

    let userId: string;
    let aviso: string | undefined;
    const existente = await acharUsuarioPorEmail(email);
    if (existente) {
      // O login é compartilhado com outros apps do projeto: liga a conta existente sem mexer na senha.
      userId = existente.id;
      aviso = "Esse e-mail já tinha uma conta. Ela foi liberada para o painel e a senha continua a mesma de antes.";
    } else {
      if (v.senha.length < 8) return { ok: false, erro: "A senha precisa ter pelo menos 8 caracteres." };
      const { data, error } = await db().auth.admin.createUser({ email, password: v.senha, email_confirm: true });
      if (error || !data.user) return { ok: false, erro: error?.message ?? "Não foi possível criar a conta." };
      userId = data.user.id;
    }

    const { error } = await db()
      .from("equipe")
      .upsert({ user_id: userId, papel: v.papel, profissional_id: v.papel === "profissional" ? v.profissionalId : null, nome: v.nome }, { onConflict: "user_id" });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/painel/configuracoes");
    return { ok: true, aviso };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível criar o acesso." };
  }
}

export async function removerAcessoEquipe(userId: string): Promise<Resp> {
  try {
    const eu = await membroOuErro({ admin: true });
    const id = z.uuid().parse(userId);
    if (id === eu.userId) return { ok: false, erro: "Você não pode remover o seu próprio acesso." };
    const { data: alvo } = await db().from("equipe").select("papel").eq("user_id", id).maybeSingle();
    if (alvo?.papel === "admin") {
      const { count } = await db().from("equipe").select("user_id", { count: "exact", head: true }).eq("papel", "admin");
      if ((count ?? 0) <= 1) return { ok: false, erro: "É preciso manter pelo menos uma administradora." };
    }
    // remove só a permissão no Beauty; a conta de login (compartilhada) permanece
    await db().from("push_subscriptions").delete().eq("equipe_user_id", id);
    const { error } = await db().from("equipe").delete().eq("user_id", id);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/painel/configuracoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível remover." };
  }
}

export async function redefinirSenhaEquipe(userId: string, novaSenha: string): Promise<Resp> {
  try {
    await membroOuErro({ admin: true });
    const id = z.uuid().parse(userId);
    if (novaSenha.length < 8 || novaSenha.length > 72) return { ok: false, erro: "A senha precisa ter de 8 a 72 caracteres." };
    const { data: ok } = await db().from("equipe").select("user_id").eq("user_id", id).maybeSingle();
    if (!ok) return { ok: false, erro: "Essa pessoa não está na equipe." };
    const { error } = await db().auth.admin.updateUserById(id, { password: novaSenha });
    if (error) return { ok: false, erro: error.message };
    return { ok: true, aviso: "Senha trocada. Avise a pessoa. Se essa conta também é usada em outro app, a senha de lá muda junto." };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível trocar a senha." };
  }
}
