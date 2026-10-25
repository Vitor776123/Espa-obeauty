"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { clienteSessao } from "@/lib/supabase/sessao";

export type EstadoLogin = { erro?: string };

const schema = z.object({ email: z.email("Informe um e-mail válido."), senha: z.string().min(1, "Informe a senha.") });

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const parsed = schema.safeParse({ email: String(form.get("email") ?? "").trim(), senha: String(form.get("senha") ?? "") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message };

  const sb = await clienteSessao();
  const { data, error } = await sb.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  if (error || !data.user) return { erro: "E-mail ou senha incorretos." };

  // O login é compartilhado com outros apps: só entra quem está na equipe do Beauty.
  const { data: membro } = await db().from("equipe").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!membro) {
    await sb.auth.signOut();
    return { erro: "Esta conta não tem acesso ao painel do Espaço Beauty." };
  }
  redirect("/painel");
}

export async function sair() {
  const sb = await clienteSessao();
  await sb.auth.signOut();
  redirect("/entrar");
}
