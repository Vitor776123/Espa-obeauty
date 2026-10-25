import { assinaturaValida, mpAtivo } from "@/lib/mercadopago";
import { processarWebhookMP } from "@/lib/pagamentos";

/** Mercado Pago avisa aqui quando um PIX muda de estado. */
export async function POST(req: Request) {
  if (!mpAtivo()) return Response.json({ ok: false, detalhe: "desativado" }, { status: 503 });

  const url = new URL(req.url);
  const corpo = await req.json().catch(() => ({}) as Record<string, unknown>);
  const tipo = url.searchParams.get("type") ?? (corpo as { type?: string }).type;
  const dataId = url.searchParams.get("data.id") ?? String((corpo as { data?: { id?: string | number } }).data?.id ?? "");

  if (tipo && tipo !== "payment") return Response.json({ ok: true, ignorado: tipo });
  if (!dataId) return Response.json({ ok: false, detalhe: "sem id" }, { status: 400 });

  if (!assinaturaValida({ xSignature: req.headers.get("x-signature"), xRequestId: req.headers.get("x-request-id"), dataId })) {
    return Response.json({ ok: false, detalhe: "assinatura inválida" }, { status: 401 });
  }

  try {
    const r = await processarWebhookMP(dataId);
    return Response.json(r);
  } catch (e) {
    console.error("[mp-webhook]", e);
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return Response.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, servico: "webhook mercado pago" });
}
