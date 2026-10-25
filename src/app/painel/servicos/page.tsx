import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarServicos } from "@/lib/dados";
import { formatBRL, formatDuracao } from "@/lib/tempo";
import { Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";
import { BotaoAtivo } from "@/app/painel/servicos/botao-ativo";

export const metadata = { title: "Serviços" };

async function Servicos() {
  await exigirAdmin();
  const servicos = await listarServicos({ incluirInativos: true });
  const grupos = new Map<string, typeof servicos>();
  for (const s of servicos) grupos.set(s.categoria, [...(grupos.get(s.categoria) ?? []), s]);

  return (
    <div className="mx-auto max-w-4xl">
      <Titulo
        titulo="Serviços"
        descricao="O que aparece no site, com foto, passo a passo e preço. Serviços desativados somem do site, mas ficam guardados."
        acao={
          <Link href="/painel/servicos/novo" className="btn btn-principal">
            Novo serviço
          </Link>
        }
      />
      {servicos.length === 0 ? (
        <Vazio titulo="Nenhum serviço cadastrado">Comece pelo botão “Novo serviço”.</Vazio>
      ) : (
        <div className="space-y-10">
          {[...grupos.entries()].map(([cat, lista]) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-3 text-2xl">
                {cat}
              </h2>
              <ul className="space-y-2.5">
                {lista.map((s) => (
                  <li key={s.id} className={`flex items-center gap-4 rounded-2xl border border-linha bg-white p-3 pr-4 ${s.ativo ? "" : "opacity-60"}`}>
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cha-claro">
                      {s.foto_url ? <Image src={s.foto_url} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/painel/servicos/${s.id}`} className="block truncate font-semibold hover:text-framboesa">
                        {s.nome}
                      </Link>
                      <p className="tabular truncate text-sm text-suave">
                        {s.tem_tamanho ? `a partir de ${formatBRL(Math.min(...s.variacoes.map((v) => v.preco), s.preco_base || Infinity))} · por tamanho` : `${formatBRL(s.preco_base)} · ${formatDuracao(s.duracao_min)}`}
                      </p>
                    </div>
                    <BotaoAtivo id={s.id} ativo={s.ativo} />
                    <Link href={`/painel/servicos/${s.id}`} className="btn btn-contorno btn-pequeno">
                      Editar
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Servicos />
    </Suspense>
  );
}
