"use client";

import { inscrever, inscricaoAtual, pushSuportado } from "@/lib/push-cliente";

export type EstadoNotificacao = "nao-suportado" | "bloqueado" | "desligado" | "ligado";

export async function estadoNotificacao(): Promise<EstadoNotificacao> {
  if (!pushSuportado()) return "nao-suportado";
  if (Notification.permission === "denied") return "bloqueado";
  const atual = await inscricaoAtual();
  return atual && Notification.permission === "granted" ? "ligado" : "desligado";
}

export async function inscreverEquipe(chavePublica: string) {
  const sub = await inscrever(chavePublica);
  const r = await fetch("/api/push/equipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!r.ok) throw new Error("Não foi possível registrar este aparelho. Tente de novo.");
}

export async function desinscreverEquipe() {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await fetch("/api/push/equipe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}
