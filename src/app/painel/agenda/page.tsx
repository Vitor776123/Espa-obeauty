import { Suspense } from "react";
import Link from "next/link";
import { exigirMembro } from "@/lib/auth";
import { getConfig, listarProfissionais } from "@/lib/dados";
import { escopoDe, listarAgendamentos, listarBloqueios } from "@/lib/painel";
import { expirarVencidas } from "@/lib/reservas";
import { dataPorExtenso, dataValida, diaDaSemana, hojeSP, nomeDiaCurto, somarDias } from "@/lib/tempo";
import { CartaoAgendamento } from "@/app/painel/cartao-agendamento";
import { Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";

export const metadata = { title: "Agenda" };

type Params = { searchParams: Promise<{ data?: string; prof?: string }> };

function href(data: string, prof: string | null) {
  const q = new URLSearchParams({ data });
  if (prof) q.set("prof", prof);
  return `/painel/agenda?${q.toString()}`;
}

async function Agenda({ searchParams }: Params) {
  const sp = await searchParams;
  const m = await exigirMembro();
  const hoje = hojeSP();
  const data = sp.data && dataValida(sp.data) ? sp.data : hoje;

  const profs = await listarProfissionais({ incluirInativos: true });
  const escopoBase = escopoDe(m);
  const prof = escopoBase ?? (sp.prof && profs.some((p) => p.id === sp.prof) ? sp.prof : null);
  const escopo = prof;

  const inicioSemana = somarDias(data, -diaDaSemana(data));
  const fimSemana = somarDias(inicioSemana, 6);

  await expirarVencidas();
  const cfg = await getConfig();
  const [semana, bloqueios] = await Promise.all([
    listarAgendamentos({ de: inicioSemana, ate: fimSemana, escopo, status: ["aguardando_pagamento", "pendente", "confirmado", "concluido", "faltou"] }),
    listarBloqueios({ de: data, ate: data, escopo }),
  ]);
  const doDia = semana.filter((a) => a.data === data);
  const maxData = somarDias(hoje, cfg.janela_dias);

  type Item = { hora: string; tipo: "ag"; ag: (typeof doDia)[number] } | { hora: string; tipo: "bl"; b: (typeof bloqueios)[number] };
  const itens: Item[] = [
    ...doDia.map((ag) => ({ hora: ag.inicio, tipo: "ag" as const, ag })),
    ...bloqueios.map((b) => ({ hora: b.inicio, tipo: "bl" as const, b })),
  ].sort((a, b) => a.hora.localeCompare(b.hora));

  const nomeProf = (id: string | null) => (id ? (profs.find((p) => p.id === id)?.nome ?? "Profissional") : "Todas as profissionais");
  const mostrarFiltro = m.papel === "admin" && profs.filter((p) => p.ativo).length > 1;

  return (
    <div className="mx-auto max-w-4xl">
      <Titulo
        titulo="Agenda"
        descricao={`${dataPorExtenso(data)}${data === hoje ? " (hoje)" : ""}`}
        acao={
          <div className="flex flex-wrap gap-2">
            <Link href={`/painel/novo?data=${data}${prof ? `&prof=${prof}` : ""}`} className="btn btn-principal">
              Novo agendamento
            </Link>
            <a href={`/painel/agenda/exportar?de=${inicioSemana}&ate=${fimSemana}${prof ? `&prof=${prof}` : ""}`} className="btn btn-contorno">
              Baixar semana (CSV)
            </a>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <Link href={href(somarDias(data, -1), prof)} className="btn btn-quieto btn-pequeno" aria-label="Dia anterior">
            ‹
          </Link>
          <Link href={href(hoje, prof)} className="btn btn-quieto btn-pequeno">
            Hoje
          </Link>
          <Link href={href(somarDias(data, 1), prof)} className="btn btn-quieto btn-pequeno" aria-label="Próximo dia">
            ›
          </Link>
        </div>
        <form action="/painel/agenda" className="flex items-center gap-2">
          <label htmlFor="ir-data" className="sr-only">
            Ir para a data
          </label>
          <input id="ir-data" type="date" name="data" defaultValue={data} className="campo !min-h-10 w-auto !py-1.5" />
          {prof && m.papel === "admin" ? <input type="hidden" name="prof" value={prof} /> : null}
          <button type="submit" className="btn btn-contorno btn-pequeno">
            Ir
          </button>
        </form>
        {mostrarFiltro ? (
          <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Profissional">
            <Link href={href(data, null)} aria-current={!prof ? "true" : undefined} className={`selo ${!prof ? "!bg-ameixa !text-perola" : ""}`}>
              Todas
            </Link>
            {profs
              .filter((p) => p.ativo)
              .map((p) => (
                <Link key={p.id} href={href(data, p.id)} aria-current={prof === p.id ? "true" : undefined} className={`selo ${prof === p.id ? "!bg-ameixa !text-perola" : ""}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} aria-hidden />
                  {p.nome}
                </Link>
              ))}
          </div>
        ) : null}
      </div>

      <ol className="mb-8 grid grid-cols-7 gap-1.5" aria-label="Semana">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = somarDias(inicioSemana, i);
          const n = semana.filter((a) => a.data === d && ["pendente", "confirmado", "concluido", "aguardando_pagamento"].includes(a.status)).length;
          const sel = d === data;
          return (
            <li key={d}>
              <Link
                href={href(d, prof)}
                aria-current={sel ? "date" : undefined}
                className={`flex flex-col items-center rounded-2xl border px-1 py-2.5 text-center transition ${
                  sel ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white hover:border-framboesa"
                }`}
              >
                <span className="text-xs capitalize">{nomeDiaCurto(i)}</span>
                <span className="tabular font-display text-2xl leading-tight">{Number(d.slice(8))}</span>
                <span className={`tabular text-xs ${sel ? "text-cha" : "text-suave"}`}>{n ? `${n} ${n === 1 ? "ag." : "ags."}` : "–"}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {itens.length === 0 ? (
        <Vazio titulo="Nada marcado neste dia">
          Para segurar um horário ou criar um compromisso, use{" "}
          <Link href="/painel/bloqueios" className="font-semibold text-framboesa underline underline-offset-4">
            Bloqueios
          </Link>
          .
        </Vazio>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((it) =>
            it.tipo === "ag" ? (
              <li key={it.ag.id}>
                <CartaoAgendamento ag={it.ag} hoje={hoje} maxData={maxData} mostrarProfissional={m.papel === "admin" && profs.length > 1} />
              </li>
            ) : (
              <li key={it.b.id} className="flex items-center gap-4 rounded-2xl border border-dashed border-linha bg-perola-2 p-4">
                <span className="tabular shrink-0 border-l-4 border-linha pl-2.5 font-display text-2xl leading-none text-suave">{it.b.inicio}</span>
                <span>
                  <span className="block font-semibold">Bloqueado até {it.b.fim}</span>
                  <span className="block text-sm text-suave">
                    {it.b.motivo || "Sem motivo informado"} · {nomeProf(it.b.profissional_id)}
                  </span>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export default function Pagina(props: Parameters<typeof Agenda>[0]) {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Agenda {...props} />
    </Suspense>
  );
}
