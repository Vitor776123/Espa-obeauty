import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { getMembro } from "@/lib/auth";

const schema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }),
});

export async function POST(req: Request) {
  const m = await getMembro();
  if (!m) return Response.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const s = parsed.data;
  const { error } = await db().from("push_subscriptions").upsert(
    { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, equipe_user_id: m.userId, agendamento_id: null },
    { onConflict: "endpoint" },
  );
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const m = await getMembro();
  if (!m) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return Response.json({ ok: false }, { status: 400 });
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("equipe_user_id", m.userId);
  return Response.json({ ok: true });
}
