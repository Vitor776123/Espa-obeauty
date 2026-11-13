import { Suspense } from "react";
import type { Metadata } from "next";
import { CabecalhoSite } from "@/components/cabecalho";
import { Marca } from "@/components/marca";
import { getConfig, listarProfissionais, listarServicos } from "@/lib/dados";
import { mpAtivo } from "@/lib/mercadopago";
import { agoraSP, somarDias } from "@/lib/tempo";
import { ChatAgendamento, type ServicoChat } from "@/app/agendar/chat";

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o serviço, veja os horários livres e reserve o seu.",
};

async function Dados({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const [{ servico }, servicos, profs, cfg] = await Promise.all([
    searchParams,
    listarServicos(),
    listarProfissionais(),
    getConfig(),
  ]);
  const hoje = agoraSP().data;
  const lista: ServicoChat[] = servicos
    .filter((s) => (s.tem_tamanho ? s.variacoes.length > 0 : s.duracao_min > 0))
    .map((s) => {
      const precos = s.tem_tamanho ? s.variacoes.map((v) => v.preco) : [s.preco_base];
      return {
        id: s.id,
        slug: s.slug,
        nome: s.nome,
        categoria: s.categoria,
        descricao: s.descricao ?? "",
        temTamanho: s.tem_tamanho,
        preco: Math.min(...precos),
        duracao: s.duracao_min,
        variacoes: s.variacoes.map((v) => ({ id: v.id, tamanho: v.tamanho, preco: v.preco, duracao: v.duracao_min })),
        profissionais: s.profissionais,
      };
    });
  return (
    <ChatAgendamento
      servicos={lista}
      profissionais={profs.map((p) => ({ id: p.id, nome: p.nome }))}
      hoje={hoje}
      maxData={somarDias(hoje, cfg.janela_dias)}
      sinalPct={cfg.sinal_percentual}
      holdMinutos={cfg.hold_minutos}
      exigeEmail={mpAtivo()}
      slugInicial={servico ?? null}
      whatsapp={cfg.whatsapp}
    />
  );
}

export default function Page(props: { searchParams: Promise<{ servico?: string }> }) {
  return (
    <>
      <div className="hidden md:block">
        <CabecalhoSite />
      </div>
      <main className="md:pb-6">
        <div className="container-site hidden pb-6 pt-10 text-center md:block">
          <p className="font-display text-5xl">Vamos marcar?</p>
          <p className="mx-auto mt-2 max-w-sm text-suave">Converse com a nossa assistente e reserve o seu horário em um minutinho.</p>
        </div>
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-perola-2 md:static md:mx-auto md:h-96 md:max-w-md md:rounded-[2rem]" aria-busy>
              <p className="animate-pulse text-sm text-suave">Abrindo a conversa… 💖</p>
            </div>
          }
        >
          <Dados searchParams={props.searchParams} />
        </Suspense>
      </main>
      <footer className="container-site hidden py-10 md:block">
        <Marca />
      </footer>
    </>
  );
}
