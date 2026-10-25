import { Suspense } from "react";
import Link from "next/link";
import { CabecalhoSite } from "@/components/cabecalho";
import { Espelho } from "@/components/espelho";
import { BarraFixa, Catalogo, CatalogoEsqueleto, Combinados, FaixaConfianca, Galeria, QuemAtende, Rodape, RodapeBasico } from "@/components/secoes-home";

export default function Home() {
  return (
    <>
      <CabecalhoSite />
      <main>
        <section className="hero-escuro no-escuro text-perola">
         <div className="container-site grid items-center gap-8 pb-10 pt-2 md:grid-cols-[1.15fr_1fr] md:gap-8 md:pb-24 md:pt-10">
          {/* No celular a foto vem primeiro; no desktop o texto fica à esquerda e a foto à direita */}
          <div className="order-first mx-auto w-full max-w-[19rem] md:order-last md:max-w-none md:px-0">
            <Espelho />
          </div>
          <div>
            <h1 className="entrada text-[clamp(2.6rem,6.4vw,5rem)]">
              Hora marcada
              <br />
              para cuidar
              <br />
              de você.
            </h1>
            <p className="entrada entrada-2 mt-6 max-w-md text-lg text-[#f3dcdc]">
              Escolha o serviço, veja os horários livres da Eliana e reserve pelo celular. Sem ligação e sem espera.
            </p>
            <div className="entrada entrada-3 mt-9 flex flex-wrap gap-3">
              <Link href="/agendar" className="btn btn-ambar">
                Agendar horário
              </Link>
              <Link href="#servicos" className="btn btn-claro">
                Ver serviços
              </Link>
            </div>
          </div>
         </div>
        </section>

        <Suspense fallback={<div className="h-24 bg-[#2a0e1b]" />}>
          <FaixaConfianca />
        </Suspense>

        <section id="servicos" className="scroll-mt-4 bg-blush">
          <div className="container-site py-20 md:py-24">
            <div className="mb-14 max-w-xl">
              <h2 className="titulo-secao">O que a gente faz</h2>
              <p className="mt-4 text-suave">Toque em um serviço para ver o procedimento, o tempo e o valor.</p>
            </div>
            <Suspense fallback={<CatalogoEsqueleto />}>
              <Catalogo />
            </Suspense>
          </div>
        </section>

        <Galeria />

        <Suspense fallback={<div className="h-60" />}>
          <QuemAtende />
        </Suspense>

        <Suspense fallback={<div className="h-80 bg-ameixa" />}>
          <Combinados />
        </Suspense>
      </main>
      <Suspense fallback={<RodapeBasico />}>
        <Rodape />
      </Suspense>
      <Suspense fallback={null}>
        <BarraFixa />
      </Suspense>
    </>
  );
}
