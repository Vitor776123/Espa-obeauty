"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ROTULO_TAMANHO, type Profissional, type Servico, type Tamanho } from "@/lib/tipos";
import { enviarFotoServico, excluirServico, salvarServico } from "@/app/painel/servicos/actions";

const TAMANHOS: Tamanho[] = ["curto", "medio", "longo"];

type LinhaTamanho = { ativo: boolean; preco: string; duracao: string };

const paraNumero = (t: string) => Number(t.replace(",", "."));

/** Reduz a foto no navegador antes de enviar (largura máxima 1400px, JPEG). */
async function reduzirImagem(arquivo: File): Promise<File> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao processar a imagem."))), "image/jpeg", 0.84));
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

export function FormularioServico({
  servico,
  profissionais,
  categorias,
  proximaOrdem,
}: {
  servico: Servico | null;
  profissionais: Profissional[];
  categorias: string[];
  proximaOrdem: number;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(servico?.nome ?? "");
  const [categoria, setCategoria] = useState(servico?.categoria ?? "");
  const [descricao, setDescricao] = useState(servico?.descricao ?? "");
  const [longa, setLonga] = useState(servico?.descricao_longa ?? "");
  const [foto, setFoto] = useState<string | null>(servico?.foto_url ?? null);
  const [passos, setPassos] = useState<string[]>(servico?.passos ?? []);
  const [temTamanho, setTemTamanho] = useState(servico?.tem_tamanho ?? false);
  const [preco, setPreco] = useState(servico && !servico.tem_tamanho ? String(servico.preco_base).replace(".", ",") : "");
  const [duracao, setDuracao] = useState(servico && !servico.tem_tamanho ? String(servico.duracao_min) : "60");
  const [tamanhos, setTamanhos] = useState<Record<Tamanho, LinhaTamanho>>(() => {
    const base = {} as Record<Tamanho, LinhaTamanho>;
    for (const t of TAMANHOS) {
      const v = servico?.variacoes.find((x) => x.tamanho === t);
      base[t] = { ativo: servico?.tem_tamanho ? !!v : true, preco: v ? String(v.preco).replace(".", ",") : "", duracao: v ? String(v.duracao_min) : "" };
    }
    return base;
  });
  const [ativo, setAtivo] = useState(servico?.ativo ?? true);
  const [ordem, setOrdem] = useState(String(servico?.ordem ?? proximaOrdem));
  const [quemFaz, setQuemFaz] = useState<string[]>(servico?.profissionais ?? profissionais.map((p) => p.id));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setErro(null);
    setEnviando(true);
    try {
      const reduzida = await reduzirImagem(arq);
      const fd = new FormData();
      fd.append("foto", reduzida);
      const r = await enviarFotoServico(fd);
      if (r.ok) setFoto(r.url);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível processar essa imagem. Tente outra.");
    } finally {
      setEnviando(false);
    }
  }

  function mover(i: number, d: -1 | 1) {
    setPassos((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const c = [...p];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const variacoes = temTamanho
      ? TAMANHOS.filter((t) => tamanhos[t].ativo).map((t) => ({
          tamanho: t,
          preco: paraNumero(tamanhos[t].preco),
          duracao: Number(tamanhos[t].duracao),
        }))
      : [];
    if (temTamanho && variacoes.some((v) => Number.isNaN(v.preco) || !v.duracao)) return setErro("Preencha preço e duração de cada tamanho marcado.");
    if (!temTamanho && Number.isNaN(paraNumero(preco || "0"))) return setErro("Preço inválido.");
    iniciar(async () => {
      const r = await salvarServico({
        id: servico?.id ?? null,
        nome,
        categoria,
        descricao: descricao || null,
        descricaoLonga: longa || null,
        fotoUrl: foto,
        passos: passos.map((p) => p.trim()).filter(Boolean),
        temTamanho,
        preco: temTamanho ? 0 : paraNumero(preco || "0"),
        duracao: temTamanho ? null : Number(duracao) || null,
        variacoes,
        ativo,
        ordem: Number(ordem) || 0,
        profissionais: quemFaz,
      });
      if (!r.ok) return setErro(r.erro);
      router.push("/painel/servicos");
      router.refresh();
    });
  }

  function excluir() {
    if (!servico) return;
    iniciar(async () => {
      const r = await excluirServico(servico.id);
      if (!r.ok) {
        setConfirmaExcluir(false);
        return setErro(r.erro);
      }
      router.push("/painel/servicos");
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl">Informações</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-nome" className="rotulo">Nome</label>
            <input id="s-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label htmlFor="s-cat" className="rotulo">Categoria</label>
            <input id="s-cat" className="campo" list="lista-cats" value={categoria} onChange={(e) => setCategoria(e.target.value)} required minLength={2} />
            <datalist id="lista-cats">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label htmlFor="s-desc" className="rotulo">Descrição curta (aparece no cartão)</label>
          <textarea id="s-desc" className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} />
        </div>
        <div>
          <label htmlFor="s-longa" className="rotulo">Descrição completa (aparece ao abrir o serviço)</label>
          <textarea id="s-longa" className="campo !min-h-32" value={longa} onChange={(e) => setLonga(e.target.value)} maxLength={2000} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Foto</h2>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative h-32 w-32 overflow-hidden rounded-2xl bg-cha-claro">
            {foto ? <Image src={foto} alt="Foto do serviço" fill sizes="128px" className="object-cover" /> : <span className="grid h-full place-items-center px-3 text-center text-sm text-suave">Sem foto</span>}
          </div>
          <div className="space-y-2">
            <input ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={aoEscolherFoto} aria-label="Escolher foto" />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-contorno btn-pequeno" onClick={() => inputFoto.current?.click()} disabled={enviando}>
                {enviando ? "Enviando…" : foto ? "Trocar foto" : "Escolher foto"}
              </button>
              {foto ? (
                <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => setFoto(null)}>
                  Remover
                </button>
              ) : null}
            </div>
            <p className="ajuda">A foto é reduzida automaticamente. Prefira imagens na horizontal ou quadradas.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Como é o procedimento</h2>
        <p className="text-sm text-suave">Passo a passo mostrado para a cliente antes de agendar.</p>
        <ol className="space-y-2">
          {passos.map((p, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 sm:flex">
              <span className="tabular mt-3 text-right font-semibold text-suave sm:w-6">{i + 1}.</span>
              <label className="sr-only" htmlFor={`passo-${i}`}>Passo {i + 1}</label>
              <textarea id={`passo-${i}`} className="campo !min-h-12 min-w-0 sm:flex-1" rows={2} value={p} maxLength={300} onChange={(e) => setPassos((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
              <div className="col-start-2 flex items-center gap-1 sm:contents">
                <div className="flex gap-1 sm:flex-col">
                  <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir passo ${i + 1}`}>↑</button>
                  <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => mover(i, 1)} disabled={i === passos.length - 1} aria-label={`Descer passo ${i + 1}`}>↓</button>
                </div>
                <button type="button" className="btn btn-quieto btn-pequeno text-erro sm:mt-1" onClick={() => setPassos((l) => l.filter((_, k) => k !== i))} aria-label={`Remover passo ${i + 1}`}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-contorno btn-pequeno" onClick={() => setPassos((l) => [...l, ""])} disabled={passos.length >= 20}>
          Adicionar passo
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Preço e duração</h2>
        <div className="flex gap-2" role="group" aria-label="Tipo de preço">
          <button type="button" aria-pressed={!temTamanho} onClick={() => setTemTamanho(false)} className={`btn btn-pequeno ${!temTamanho ? "btn-escuro" : "btn-contorno"}`}>
            Preço único
          </button>
          <button type="button" aria-pressed={temTamanho} onClick={() => setTemTamanho(true)} className={`btn btn-pequeno ${temTamanho ? "btn-escuro" : "btn-contorno"}`}>
            Por tamanho de cabelo
          </button>
        </div>
        {!temTamanho ? (
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-preco" className="rotulo">Preço (R$)</label>
              <input id="s-preco" className="campo tabular" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="s-dur" className="rotulo">Duração (minutos)</label>
              <input id="s-dur" className="campo tabular" inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} required />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {TAMANHOS.map((t) => (
              <div key={t} className="grid items-end gap-3 rounded-2xl border border-linha bg-white p-4 sm:grid-cols-[10rem_1fr_1fr]">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" className="h-5 w-5 accent-[#a8325a]" checked={tamanhos[t].ativo} onChange={(e) => setTamanhos((s) => ({ ...s, [t]: { ...s[t], ativo: e.target.checked } }))} />
                  {ROTULO_TAMANHO[t]}
                </label>
                <div>
                  <label htmlFor={`p-${t}`} className="rotulo">Preço (R$)</label>
                  <input id={`p-${t}`} className="campo tabular" inputMode="decimal" disabled={!tamanhos[t].ativo} value={tamanhos[t].preco} onChange={(e) => setTamanhos((s) => ({ ...s, [t]: { ...s[t], preco: e.target.value } }))} />
                </div>
                <div>
                  <label htmlFor={`d-${t}`} className="rotulo">Duração (min)</label>
                  <input id={`d-${t}`} className="campo tabular" inputMode="numeric" disabled={!tamanhos[t].ativo} value={tamanhos[t].duracao} onChange={(e) => setTamanhos((s) => ({ ...s, [t]: { ...s[t], duracao: e.target.value.replace(/\D/g, "") } }))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Quem faz e visibilidade</h2>
        <fieldset>
          <legend className="rotulo">Profissionais que fazem este serviço</legend>
          <div className="flex flex-wrap gap-2">
            {profissionais.map((p) => {
              const marcado = quemFaz.includes(p.id);
              return (
                <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition ${marcado ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white"}`}>
                  <input type="checkbox" className="sr-only" checked={marcado} onChange={(e) => setQuemFaz((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} aria-hidden />
                  {p.nome}
                </label>
              );
            })}
          </div>
          {quemFaz.length === 0 ? <p className="ajuda">Sem nenhuma profissional marcada, o serviço não terá horários no site.</p> : null}
        </fieldset>
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#a8325a]" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Aparece no site
          </label>
          <div>
            <label htmlFor="s-ordem" className="rotulo">Ordem na lista</label>
            <input id="s-ordem" className="campo tabular !w-24" inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      </section>

      {erro ? (
        <p role="alert" className="rounded-xl bg-[#fbe3e1] px-4 py-3 text-sm font-medium text-[#8c1d17]">{erro}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-6">
        <button type="submit" className="btn btn-principal" disabled={pendente || enviando}>
          {pendente ? "Salvando…" : "Salvar serviço"}
        </button>
        <button type="button" className="btn btn-quieto" onClick={() => router.push("/painel/servicos")}>
          Cancelar
        </button>
        {servico ? (
          <div className="ml-auto">
            {confirmaExcluir ? (
              <span className="flex items-center gap-2 text-sm">
                Excluir de vez?
                <button type="button" className="btn btn-perigo btn-pequeno" onClick={excluir} disabled={pendente}>Sim, excluir</button>
                <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => setConfirmaExcluir(false)}>Não</button>
              </span>
            ) : (
              <button type="button" className="btn btn-quieto btn-pequeno text-erro" onClick={() => setConfirmaExcluir(true)}>
                Excluir serviço
              </button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
