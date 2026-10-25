import { getMembro } from "@/lib/auth";
import { escopoDe, listarAgendamentos } from "@/lib/painel";
import { dataValida, formatTelefone } from "@/lib/tempo";
import { ROTULO_PAGAMENTO, ROTULO_STATUS, ROTULO_TAMANHO } from "@/lib/tipos";

function celula(v: string | number | null | undefined) {
  const t = String(v ?? "");
  // evita que o Excel trate texto como fórmula
  const seguro = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return `"${seguro.replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const m = await getMembro();
  if (!m) return new Response("Não autorizado", { status: 401 });

  const url = new URL(req.url);
  const de = url.searchParams.get("de") ?? "";
  const ate = url.searchParams.get("ate") ?? "";
  if (!dataValida(de) || !dataValida(ate) || de > ate) return new Response("Período inválido", { status: 400 });

  let escopo = escopoDe(m);
  const prof = url.searchParams.get("prof");
  if (!escopo && prof && /^[0-9a-f-]{36}$/.test(prof)) escopo = prof;

  const ags = await listarAgendamentos({ de, ate, escopo });
  const linhas = [
    ["Data", "Início", "Fim", "Cliente", "Telefone", "Serviço", "Tamanho", "Profissional", "Situação", "Pagamento", "Valor", "Pago", "Observações"],
    ...ags.map((a) => [
      a.data.split("-").reverse().join("/"),
      a.inicio,
      a.fim,
      a.cliente.nome,
      formatTelefone(a.cliente.telefone),
      a.servico.nome,
      a.variacao ? ROTULO_TAMANHO[a.variacao.tamanho] : "",
      a.profissional.nome,
      ROTULO_STATUS[a.status],
      ROTULO_PAGAMENTO[a.pagamento_status],
      a.valor_total.toFixed(2).replace(".", ","),
      a.valor_pago.toFixed(2).replace(".", ","),
      a.observacoes ?? "",
    ]),
  ];
  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="agenda-${de}_a_${ate}.csv"`,
      "cache-control": "no-store",
    },
  });
}
