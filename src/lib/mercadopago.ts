import "server-only";
import crypto from "node:crypto";

const API = "https://api.mercadopago.com";

/** Sem o token, o site funciona em modo PIX manual (a equipe confirma o pagamento). */
export function mpAtivo(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function cabecalhos(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type PixCriado = {
  id: string;
  copiaECola: string;
  qrBase64: string;
  expiraEm: string; // ISO UTC
  bruto: unknown;
};

/** Data no formato que o Mercado Pago pede, com fuso de São Paulo. */
function dataComFusoSP(ms: number): string {
  return new Date(ms - 3 * 3_600_000).toISOString().replace("Z", "-03:00");
}

export async function criarPix(p: {
  valor: number;
  descricao: string;
  referencia: string; // id do agendamento
  email: string;
  nome: string;
  expiraEmMs: number;
}): Promise<PixCriado> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const [primeiro, ...resto] = p.nome.trim().split(/\s+/);
  const resp = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: cabecalhos({ "X-Idempotency-Key": `${p.referencia}-${p.valor.toFixed(2)}` }),
    body: JSON.stringify({
      transaction_amount: Number(p.valor.toFixed(2)),
      description: p.descricao,
      payment_method_id: "pix",
      date_of_expiration: dataComFusoSP(p.expiraEmMs),
      external_reference: p.referencia,
      notification_url: site ? `${site}/api/mp/webhook` : undefined,
      payer: { email: p.email, first_name: primeiro, last_name: resto.join(" ") || undefined },
    }),
    cache: "no-store",
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Mercado Pago recusou a cobrança (${resp.status}): ${corpo?.message ?? "sem detalhe"}`);
  }
  const dados = corpo?.point_of_interaction?.transaction_data;
  if (!dados?.qr_code) throw new Error("Mercado Pago não devolveu o código PIX.");
  return {
    id: String(corpo.id),
    copiaECola: dados.qr_code,
    qrBase64: dados.qr_code_base64 ?? "",
    expiraEm: new Date(p.expiraEmMs).toISOString(),
    bruto: corpo,
  };
}

export type PagamentoMP = { id: string; status: string; external_reference: string | null; transaction_amount: number };

export async function buscarPagamentoMP(id: string): Promise<PagamentoMP | null> {
  const resp = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: cabecalhos(),
    cache: "no-store",
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Mercado Pago respondeu ${resp.status} ao consultar o pagamento.`);
  const c = await resp.json();
  return {
    id: String(c.id),
    status: c.status,
    external_reference: c.external_reference ?? null,
    transaction_amount: Number(c.transaction_amount),
  };
}

/**
 * Confere a assinatura do webhook (x-signature). Se não houver segredo configurado,
 * não bloqueia: a confirmação real sempre é feita consultando a API do Mercado Pago.
 */
export function assinaturaValida(p: { xSignature: string | null; xRequestId: string | null; dataId: string }): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return true;
  if (!p.xSignature) return false;
  const partes = Object.fromEntries(
    p.xSignature.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const manifesto = `id:${p.dataId.toLowerCase()};request-id:${p.xRequestId ?? ""};ts:${ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
