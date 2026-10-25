import { Suspense } from "react";
import type { Metadata } from "next";
import { CabecalhoSite } from "@/components/cabecalho";
import { Marca } from "@/components/marca";
import { getConfig, listarProfissionais, listarServicos } from "@/lib/dados";
import { mpAtivo } from "@/lib/mercadopago";
import { agoraSP, somarDias } from "@/lib/tempo";
import { Wizard, type ServicoWizard } from "@/app/agendar/wizard";

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
  const lista: ServicoWizard[] = servicos
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
    <Wizard
      servicos={lista}
      profissionais={profs.map((p) => ({ id: p.id, nome: p.nome }))}
      hoje={hoje}
      maxData={somarDias(hoje, cfg.janela_dias)}
      sinalPct={cfg.sinal_percentual}
      holdMinutos={cfg.hold_minutos}
      exigeEmail={mpAtivo()}
      slugInicial={servico ?? null}
    />
  );
}

export default function Page(props: { searchParams: Promise<{ servico?: string }> }) {
  return (
    <>
      <CabecalhoSite />
      <main>
        <Suspense
          fallback={
            <div className="container-site py-16" aria-busy>
              <div className="h-10 w-2/3 animate-pulse rounded bg-cha-claro" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-cha-claro" />
                ))}
              </div>
            </div>
          }
        >
          <Dados searchParams={props.searchParams} />
        </Suspense>
      </main>
      <footer className="container-site py-10">
        <Marca />
      </footer>
    </>
  );
}
