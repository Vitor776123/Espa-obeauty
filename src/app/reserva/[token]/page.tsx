import Image from "next/image";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoSite } from "@/components/cabecalho";
import { Marca } from "@/components/marca";
import { getConfig } from "@/lib/dados";
import { agendamentoPorToken, expirarVencidas, podeAlterar, calcularCobranca } from "@/lib/reservas";
import { pixPendente } from "@/lib/pagamentos";
import { mpAtivo } from "@/lib/mercadopago";
import { agoraSP, dataPorExtenso, formatBRL, formatDuracao, somarDias } from "@/lib/tempo";
import { ROTULO_TAMANHO } from "@/lib/tipos";
import { AcoesCliente, AvisoLembrete, PixAutomatico, PixManual } from "@/app/reserva/[token]/partes";

export const metadata: Metadata = {
  title: "Sua reserva",
  robots: { index: false, follow: false },
};

async function Conteudo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await expirarVencidas();
  const ag = await agendamentoPorToken(token);
  if (!ag) notFound();
  const cfg = await getConfig();

  const zap = cfg.whatsapp?.replace(/\D/g, "");
  const zapLink = zap
    ? `https://wa.me/55${zap}?text=${encodeURIComponent(
        `Olá! Sou ${ag.cliente.nome}, reserva de ${ag.servico.nome} em ${dataPorExtenso(ag.data)} às ${ag.inicio}.`,
      )}`
    : null;

  const hoje = agoraSP().data;
  const cobranca = calcularCobranca(ag.valor_total, ag.tipo_pagamento, cfg.sinal_percentual);
  const aguardando = ag.status === "aguardando_pagamento";
  const ativa = ["aguardando_pagamento", "pendente", "confirmado"].includes(ag.status);
  const pix = aguardando && mpAtivo() ? await pixPendente(ag.id) : null;
  const alterar = ativa ? await podeAlterar(ag) : { pode: false as const, motivo: undefined };

  const titulos: Record<string, { h: string; p: string }> = {
    aguardando_pagamento: { h: "Falta pouco para garantir seu horário", p: "Conclua o pagamento abaixo e o horário é seu." },
    pendente: { h: "Recebemos seu aviso", p: "A Eliana confere o pagamento e confirma o horário em breve. Você pode fechar esta página." },
    confirmado: { h: "Horário confirmado", p: "Te esperamos! Guarde o link desta página: é por ele que você remarca ou cancela." },
    concluido: { h: "Atendimento concluído", p: "Obrigada pela visita. Foi um prazer cuidar de você." },
    cancelado: { h: "Reserva cancelada", p: "O horário voltou para a agenda." },
    expirado: { h: "O tempo para pagar acabou", p: "Liberamos o horário para outras clientes. Você pode reservar de novo." },
    faltou: { h: "Atendimento não realizado", p: "Quer marcar outro horário?" },
  };
  const t = titulos[ag.status] ?? titulos.confirmado;

  return (
    <div className="container-site max-w-3xl py-8 md:py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-3 text-sm font-semibold text-framboesa">Olá, {ag.cliente.nome.split(" ")[0]}</p>
          <h1 className="text-4xl sm:text-5xl">{t.h}</h1>
          <p className="mt-4 max-w-xl text-lg text-suave">{t.p}</p>
        </div>
        {ag.status === "confirmado" || ag.status === "concluido" ? (
          <Image src="/fotos/recorte-joia.webp" alt="Eliana fazendo joinha" width={640} height={777} sizes="9rem" className="hidden w-32 flex-none sm:block md:w-40" />
        ) : null}
      </div>

      <div className="mt-8 space-y-6">
        {aguardando && pix ? (
          <PixAutomatico token={token} copiaECola={pix.copiaECola} qrBase64={pix.qrBase64} valor={pix.valor} expiraEm={pix.expiraEm} />
        ) : null}
        {aguardando && !mpAtivo() ? (
          <PixManual
            token={token}
            chave={cfg.chave_pix}
            favorecido={cfg.pix_favorecido}
            valor={cobranca}
            zapLink={zapLink}
            expiraEm={ag.expira_em}
          />
        ) : null}

        <section className="cartao overflow-hidden" aria-label="Detalhes da reserva">
          <div className="p-6 sm:p-8">
            <h2 className="text-3xl">{ag.servico.nome}</h2>
            {ag.variacao ? <p className="text-suave">{ROTULO_TAMANHO[ag.variacao.tamanho]}</p> : null}
            <p className="mt-4 text-xl font-semibold first-letter:uppercase">{dataPorExtenso(ag.data)}</p>
            <p className="tabular text-suave">
              {ag.inicio} às {ag.fim} · {formatDuracao(ag.duracao_total)} · <span className="whitespace-nowrap">com {ag.profissional.nome}</span>
            </p>
          </div>
          <div className="border-t border-dashed border-linha bg-perola-2 px-6 py-5 sm:px-8">
            <dl className="tabular grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-suave">Valor</dt>
                <dd className="text-lg font-semibold">{formatBRL(ag.valor_total)}</dd>
              </div>
              <div>
                <dt className="text-suave">Já pago</dt>
                <dd className="text-lg font-semibold">{formatBRL(ag.valor_pago)}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-suave">A pagar no salão</dt>
                <dd className="text-lg font-semibold">{formatBRL(Math.max(0, ag.valor_total - (aguardando ? Math.max(ag.valor_pago, cobranca) : ag.valor_pago)))}</dd>
              </div>
            </dl>
          </div>
        </section>

        {ag.status === "confirmado" || ag.status === "pendente" ? (
          <div className="flex flex-wrap gap-3">
            <a href={`/api/ics/${token}`} className="btn btn-contorno btn-pequeno">
              Salvar na agenda do celular
            </a>
            {zapLink ? (
              <a href={zapLink} target="_blank" rel="noreferrer" className="btn btn-quieto btn-pequeno">
                Falar no WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}

        {ag.status === "confirmado" || ag.status === "pendente" ? (
          <AvisoLembrete token={token} chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        ) : null}

        {ativa ? (
          <AcoesCliente
            token={token}
            hoje={hoje}
            maxData={somarDias(hoje, cfg.janela_dias)}
            pode={alterar.pode}
            motivo={alterar.motivo ?? null}
            temSinal={ag.valor_pago > 0}
            zapLink={zapLink}
          />
        ) : (
          <Link href="/agendar" className="btn btn-principal">
            Agendar um novo horário
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Page(props: { params: Promise<{ token: string }> }) {
  return (
    <>
      <CabecalhoSite />
      <main>
        <Suspense
          fallback={
            <div className="container-site max-w-3xl py-14" aria-busy>
              <div className="h-12 w-3/4 animate-pulse rounded bg-cha-claro" />
              <div className="mt-8 h-64 animate-pulse rounded-3xl bg-cha-claro" />
            </div>
          }
        >
          <Conteudo params={props.params} />
        </Suspense>
      </main>
      <footer className="container-site py-10">
        <Marca />
      </footer>
    </>
  );
}
