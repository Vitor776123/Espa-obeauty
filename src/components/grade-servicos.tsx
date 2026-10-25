"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatBRL, formatDuracao } from "@/lib/tempo";
import { ROTULO_TAMANHO, type Tamanho } from "@/lib/tipos";
import { IconeCategoria } from "@/components/icones";

export type ServicoPublico = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  descricao: string;
  descricaoLonga: string;
  foto: string | null;
  passos: string[];
  temTamanho: boolean;
  preco: number; // menor preço
  duracaoMin: number; // menor duração
  duracaoMax: number;
  variacoes: { tamanho: Tamanho; preco: number; duracao: number }[];
};

function textoPreco(s: ServicoPublico) {
  return s.temTamanho ? `a partir de ${formatBRL(s.preco)}` : formatBRL(s.preco);
}
function textoDuracao(s: ServicoPublico) {
  if (s.duracaoMin === s.duracaoMax) return formatDuracao(s.duracaoMin);
  return `${formatDuracao(s.duracaoMin)} a ${formatDuracao(s.duracaoMax)}`;
}

const GRADIENTES = [
  ["#d98aa0", "#a8325a"],
  ["#e7aab4", "#b8566f"],
  ["#c98ab0", "#7b3f68"],
  ["#efb8a8", "#c46a6a"],
  ["#d6a0c0", "#8a4a7a"],
  ["#e9b4b4", "#a85a62"],
];
function hash(t: string) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h;
}

function Foto({ s, sizes, className }: { s: ServicoPublico; sizes: string; className?: string }) {
  if (!s.foto) {
    const g = GRADIENTES[hash(s.nome) % GRADIENTES.length];
    return (
      <div
        className={`grid place-items-center text-white/90 ${className ?? ""}`}
        style={{ background: `radial-gradient(ellipse at 30% 15%, rgb(255 255 255 / 0.38), transparent 55%), linear-gradient(160deg, ${g[0]}, ${g[1]})` }}
      >
        <IconeCategoria categoria={s.categoria} className="h-14 w-14 sm:h-16 sm:w-16" />
      </div>
    );
  }
  return <Image src={s.foto} alt={`Serviço: ${s.nome}`} fill sizes={sizes} className={`object-cover ${className ?? ""}`} />;
}

export function GradeServicos({ servicos }: { servicos: ServicoPublico[] }) {
  const [aberto, setAberto] = useState<ServicoPublico | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  // Ordem de exibição: o carro-chefe (tratamentos e coloração) primeiro, depois cabelo, unhas e o resto.
  const ORDEM_CATEGORIAS = ["Tratamentos e coloração", "Cabelo", "Unhas"];
  const posicao = (c: string) => {
    const i = ORDEM_CATEGORIAS.indexOf(c);
    return i === -1 ? ORDEM_CATEGORIAS.length : i;
  };
  const categorias = Array.from(new Set(servicos.map((s) => s.categoria))).sort((a, b) => posicao(a) - posicao(b));

  return (
    <>
      <div className="space-y-16">
        {categorias.map((cat) => (
          <div key={cat}>
            <h3 className="mb-6 font-display text-2xl italic text-framboesa-2 sm:text-3xl">{cat}</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
              {servicos
                .filter((s) => s.categoria === cat)
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setAberto(s)}
                      className="group block w-full text-left"
                      aria-haspopup="dialog"
                    >
                      <span className="arco-suave relative block aspect-[4/5] overflow-hidden bg-cha-claro shadow-suave ring-1 ring-linha transition duration-500 group-hover:-translate-y-1 group-hover:shadow-camarim">
                        <Foto s={s} sizes="(min-width:1024px) 17rem, (min-width:768px) 30vw, 46vw" className="transition duration-700 group-hover:scale-105" />
                      </span>
                      <span className="mt-4 block font-display text-xl leading-tight sm:text-[1.4rem]">{s.nome}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-suave">{s.descricao}</span>
                      <span className="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
                        <span>{textoPreco(s)}</span>
                        <span className="font-normal text-suave">{textoDuracao(s)}</span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <dialog
        ref={ref}
        className="gaveta"
        aria-labelledby="gaveta-titulo"
        onClose={() => setAberto(null)}
        onClick={(e) => {
          if (e.target === ref.current) setAberto(null);
        }}
      >
        {aberto ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="relative">
                <div className="relative mx-auto mt-6 aspect-[16/10] max-h-52 w-[calc(100%-3rem)] max-w-xl sm:max-h-60 overflow-hidden rounded-2xl bg-cha-claro">
                  <Foto s={aberto} sizes="(min-width:768px) 36rem, 90vw" />
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(null)}
                  className="btn btn-quieto absolute right-3 top-0 bg-perola/90"
                  aria-label="Fechar"
                >
                  Fechar
                </button>
              </div>

              <div className="px-6 pb-4 pt-6 sm:px-10">
                <p className="text-sm font-medium text-framboesa">{aberto.categoria}</p>
                <h2 id="gaveta-titulo" className="mt-1 text-3xl sm:text-4xl">
                  {aberto.nome}
                </h2>
                <p className="mt-3 max-w-prose text-base text-suave">{aberto.descricaoLonga || aberto.descricao}</p>

                {aberto.temTamanho ? (
                  <table className="tabular mt-6 w-full max-w-md text-left text-sm">
                    <caption className="sr-only">Valores e tempo por tamanho do cabelo</caption>
                    <thead>
                      <tr className="border-b border-linha text-suave">
                        <th className="py-2 font-medium">Tamanho</th>
                        <th className="py-2 font-medium">Valor</th>
                        <th className="py-2 font-medium">Tempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aberto.variacoes.map((v) => (
                        <tr key={v.tamanho} className="border-b border-linha/70">
                          <td className="py-2.5">{ROTULO_TAMANHO[v.tamanho]}</td>
                          <td className="py-2.5 font-semibold">{formatBRL(v.preco)}</td>
                          <td className="py-2.5">{formatDuracao(v.duracao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="tabular mt-5 flex gap-4 text-sm">
                    <span className="font-semibold">{formatBRL(aberto.preco)}</span>
                    <span className="text-suave">{formatDuracao(aberto.duracaoMin)}</span>
                  </p>
                )}

                {aberto.passos.length > 0 ? (
                  <>
                    <h3 className="mt-8 text-xl">Como é o procedimento</h3>
                    <ol className="mt-4 space-y-3.5">
                      {aberto.passos.map((p, i) => (
                        <li key={i} className="flex gap-3.5">
                          <span className="tabular mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full bg-ameixa text-sm font-semibold text-perola">
                            {i + 1}
                          </span>
                          <span className="pt-0.5 leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : null}
              </div>
            </div>

            <div className="border-t border-linha bg-perola px-6 py-4 sm:px-10">
              <Link href={`/agendar?servico=${aberto.slug}`} className="btn btn-principal w-full sm:w-auto">
                Agendar este serviço
              </Link>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
