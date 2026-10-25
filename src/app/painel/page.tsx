import { Suspense } from "react";
import Link from "next/link";
import { exigirMembro } from "@/lib/auth";
import { getConfig } from "@/lib/dados";
import { calcularMetricas, escopoDe, listarAgendamentos, proximosDias } from "@/lib/painel";
import { expirarVencidas } from "@/lib/reservas";
import { dataPorExtenso, formatBRL, hojeSP, nomeDiaCurto, diaDaSemana, somarDias } from "@/lib/tempo";
import { CartaoAgendamento } from "@/app/painel/cartao-agendamento";
import { AvisoAtivar } from "@/app/painel/aviso-ativar";
import { Indicador, Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";

export const metadata = { title: "Hoje" };

async function Hoje() {
  const m = await exigirMembro();
  const escopo = escopoDe(m);
  const hoje = hojeSP();
  await expirarVencidas();
  const cfg = await getConfig();
  const maxData = somarDias(hoje, cfg.janela_dias);

  const [doDia, paraConferir, semana] = await Promise.all([
    listarAgendamentos({ de: hoje, ate: hoje, escopo, status: ["aguardando_pagamento", "pendente", "confirmado", "concluido", "faltou"] }),
    listarAgendamentos({ de: hoje, ate: maxData, escopo, status: ["pendente"] }),
    proximosDias(hoje, 7, escopo),
  ]);

  const met = calcularMetricas(doDia);
  const maior = Math.max(1, ...semana.map((d) => d.total));
  const primeiroNome = m.nome.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <AvisoAtivar chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      <Titulo
        titulo={`Olá, ${primeiroNome}.`}
        descricao={`Hoje é ${dataPorExtenso(hoje)}. ${
          met.atendimentos === 0 ? "Nenhum atendimento marcado até agora." : `${met.atendimentos} ${met.atendimentos === 1 ? "atendimento" : "atendimentos"} no dia.`
        }`}
        acao={
          <Link href="/painel/novo" className="btn btn-principal">
            Novo agendamento
          </Link>
        }
      />

      <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Agendamentos hoje" valor={String(met.atendimentos)} nota={met.aguardando ? `${met.aguardando} aguardando pagamento` : undefined} destaque />
        <Indicador rotulo="Faturamento previsto" valor={formatBRL(met.previsto)} />
        <Indicador rotulo="Já recebido" valor={formatBRL(met.recebido)} />
        <Indicador rotulo="Pendente de pagamento" valor={formatBRL(met.aReceber)} />
      </section>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="h-dia">
          <h2 id="h-dia" className="mb-4 text-2xl">
            Atendimentos de hoje
          </h2>
          {doDia.length === 0 ? (
            <Vazio titulo="Dia livre">
              Quando alguém reservar pelo site, aparece aqui. Você também pode{" "}
              <Link href="/painel/novo" className="font-semibold text-framboesa underline underline-offset-4">
                marcar um horário
              </Link>
              .
            </Vazio>
          ) : (
            <ul className="space-y-2.5">
              {doDia.map((a) => (
                <li key={a.id}>
                  <CartaoAgendamento ag={a} hoje={hoje} maxData={maxData} mostrarProfissional={m.papel === "admin"} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section aria-labelledby="h-conferir">
            <h2 id="h-conferir" className="mb-4 text-2xl">
              Para conferir
            </h2>
            {paraConferir.length === 0 ? (
              <p className="text-sm text-suave">Nenhum pagamento esperando conferência.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-suave">A cliente avisou que pagou o PIX. Confira no seu banco e confirme.</p>
                <ul className="space-y-2.5">
                  {paraConferir.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <CartaoAgendamento ag={a} hoje={hoje} maxData={maxData} mostrarData compacto mostrarProfissional={m.papel === "admin"} />
                    </li>
                  ))}
                </ul>
                {paraConferir.length > 6 ? (
                  <Link href="/painel/agenda" className="mt-3 inline-block text-sm font-semibold text-framboesa underline underline-offset-4">
                    Ver todos ({paraConferir.length})
                  </Link>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="h-semana">
            <h2 id="h-semana" className="mb-4 text-2xl">
              Próximos 7 dias
            </h2>
            <ol className="flex h-36 items-end gap-2" aria-label="Atendimentos por dia">
              {semana.map((d, i) => (
                <li key={d.data} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="tabular text-xs font-semibold">{d.total || ""}</span>
                  <span
                    className={`w-full rounded-t-lg ${i === 0 ? "bg-framboesa" : "bg-cha"}`}
                    style={{ height: `${Math.max(6, (d.total / maior) * 84)}px` }}
                    aria-hidden
                  />
                  <span className="text-xs capitalize text-suave">{i === 0 ? "hoje" : nomeDiaCurto(diaDaSemana(d.data))}</span>
                  <span className="sr-only">{`${d.total} atendimentos em ${dataPorExtenso(d.data)}`}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Hoje />
    </Suspense>
  );
}
