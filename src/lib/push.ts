import "server-only";
import webpush from "web-push";
import { db } from "@/lib/supabase/admin";

export type Aviso = { titulo: string; corpo: string; url: string; tag?: string };

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@example.com", pub, priv);
  configurado = true;
  return true;
}

type Inscricao = { id: string; endpoint: string; p256dh: string; auth: string };

async function enviar(inscricoes: Inscricao[], aviso: Aviso): Promise<{ enviados: number; falhas: number }> {
  if (!configurar() || !inscricoes.length) return { enviados: 0, falhas: 0 };
  let enviados = 0;
  let falhas = 0;
  const mortas: string[] = [];
  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(aviso),
          { TTL: 60 * 60 * 12 },
        );
        enviados++;
      } catch (e) {
        falhas++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) mortas.push(s.id);
      }
    }),
  );
  if (mortas.length) await db().from("push_subscriptions").delete().in("id", mortas);
  return { enviados, falhas };
}

/** Avisa o aparelho da cliente que se inscreveu naquela reserva. */
export async function avisarCliente(agendamentoId: string, aviso: Aviso) {
  const { data } = await db()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("agendamento_id", agendamentoId);
  return enviar((data ?? []) as Inscricao[], aviso);
}

/** Avisa a equipe (todas as pessoas com notificações ligadas no painel). */
export async function avisarEquipe(aviso: Aviso) {
  const { data } = await db()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .not("equipe_user_id", "is", null);
  return enviar((data ?? []) as Inscricao[], aviso);
}

/** Nunca derruba o fluxo principal por causa de uma notificação. */
export async function seguro(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("[push]", e);
  }
}
