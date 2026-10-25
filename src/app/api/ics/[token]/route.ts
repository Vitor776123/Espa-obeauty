import { agendamentoPorToken } from "@/lib/reservas";
import { getConfig } from "@/lib/dados";
import { instanteSP } from "@/lib/tempo";

function fmt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ag = await agendamentoPorToken(token);
  if (!ag || ["cancelado", "expirado"].includes(ag.status)) return new Response("Não encontrado", { status: 404 });
  const cfg = await getConfig();
  const inicio = instanteSP(ag.data, ag.inicio);
  const fim = instanteSP(ag.data, ag.fim);
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Espaco Beauty//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ag.id}@espacobeauty`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(inicio)}`,
    `DTEND:${fmt(fim)}`,
    `SUMMARY:${esc(`${ag.servico.nome} — ${cfg.nome_salao}`)}`,
    `DESCRIPTION:${esc(`Com ${ag.profissional.nome}. Para remarcar ou cancelar, use o link da sua reserva.`)}`,
    ...(cfg.endereco ? [`LOCATION:${esc(cfg.endereco)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Seu horário no Espaço Beauty é amanhã",
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="espaco-beauty.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
