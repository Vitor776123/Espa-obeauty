import { db } from "@/lib/supabase/admin";
import { expirarVencidas } from "@/lib/reservas";
import { avisarCliente, avisarEquipe } from "@/lib/push";
import { agoraSP, dataCurta, somarDias } from "@/lib/tempo";

/**
 * Rotina diária (Vercel Cron, 9h de Brasília):
 *  1. libera horários presos por pagamentos que não saíram;
 *  2. avisa as clientes com horário amanhã;
 *  3. manda para a equipe o resumo do dia.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const hoje = agoraSP().data;
  const amanha = somarDias(hoje, 1);
  const resultado = { expiradas: 0, lembretes: 0, semAparelho: 0, resumoEquipe: false };

  resultado.expiradas = await expirarVencidas();

  const { data: amanhaAgs } = await db()
    .from("agendamentos")
    .select("id, inicio, token_gerenciar, servico:servicos(nome), profissional:profissionais(nome)")
    .eq("data", amanha)
    .eq("status", "confirmado");

  for (const a of (amanhaAgs ?? []) as unknown as {
    id: string;
    inicio: string;
    token_gerenciar: string;
    servico: { nome: string };
    profissional: { nome: string };
  }[]) {
    const { data: jaEnviado } = await db()
      .from("notificacoes_log")
      .select("id")
      .eq("agendamento_id", a.id)
      .eq("tipo", "lembrete_24h")
      .maybeSingle();
    if (jaEnviado) continue;
    const r = await avisarCliente(a.id, {
      titulo: "Amanhã é dia de se cuidar",
      corpo: `${a.servico.nome} às ${a.inicio.slice(0, 5)} com ${a.profissional.nome}. Precisa remarcar? Toque aqui.`,
      url: `/reserva/${a.token_gerenciar}`,
      tag: `lembrete-${a.id}`,
    });
    await db().from("notificacoes_log").insert({
      agendamento_id: a.id,
      tipo: "lembrete_24h",
      ok: r.enviados > 0,
      detalhe: r.enviados > 0 ? `enviado para ${r.enviados} aparelho(s)` : "cliente sem notificações ativas",
    });
    if (r.enviados > 0) resultado.lembretes++;
    else resultado.semAparelho++;
  }

  const { data: hojeAgs } = await db()
    .from("agendamentos")
    .select("inicio")
    .eq("data", hoje)
    .in("status", ["confirmado", "pendente"])
    .order("inicio");
  if (hojeAgs?.length) {
    const r = await avisarEquipe({
      titulo: `Hoje: ${hojeAgs.length} ${hojeAgs.length === 1 ? "atendimento" : "atendimentos"}`,
      corpo: `Começa às ${hojeAgs[0].inicio.slice(0, 5)} · ${dataCurta(hoje)}`,
      url: "/painel",
      tag: `resumo-${hoje}`,
    });
    resultado.resumoEquipe = r.enviados > 0;
  }

  return Response.json({ ok: true, ...resultado });
}
