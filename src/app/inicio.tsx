"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { carregarDadosChat, type DadosChat, type ServicoChat } from "@/app/agendar/actions";
import { ChatAgendamento, ChatCarregando } from "@/app/agendar/chat";
import { Espelho } from "@/components/espelho";
import { IconeZap } from "@/components/icones";
import { Marca } from "@/components/marca";
import { emojiServico } from "@/lib/chat-agendamento";
import { formatBRL, formatDuracao, soDigitos } from "@/lib/tempo";
import { ROTULO_TAMANHO } from "@/lib/tipos";

/* ---------- o que existe na tela inicial ---------- */
type Tela =
  | { tipo: "servicos" }
  | { tipo: "grupo"; id: string }
  | { tipo: "servico"; id: string }
  | { tipo: "agendar"; slug: string | null }
  | { tipo: "sobre" };

type Item = { uid: number; tela: Tela; saindo?: boolean };

type Grupo = { id: string; emoji: string; titulo: string; chamada: string; preferida: string };

const GRUPOS: Grupo[] = [
  { id: "maos", emoji: "💅", titulo: "Minhas mãos", chamada: "Quero fazer minhas mãos", preferida: "mao" },
  { id: "cabelo", emoji: "💇‍♀️", titulo: "Meu cabelo", chamada: "Quero fazer meu cabelo", preferida: "escova" },
  { id: "rosto", emoji: "👁️", titulo: "Sobrancelha e buço", chamada: "Quero cuidar da sobrancelha e do buço", preferida: "sobrancelha" },
  { id: "pes", emoji: "🦶", titulo: "Meus pés", chamada: "Quero cuidar dos meus pés", preferida: "pe" },
  { id: "outros", emoji: "✨", titulo: "Outros serviços", chamada: "Ver outros serviços", preferida: "" },
];

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Em quais grupos o serviço aparece. "Pé e Mão", por exemplo, aparece em mãos e em pés. */
function gruposDo(s: ServicoChat): string[] {
  const n = normalizar(s.nome);
  const c = normalizar(s.categoria);
  const ids: string[] = [];
  if (/\bmao\b|\bmaos\b|unha|manicure/.test(n)) ids.push("maos");
  if (/\bpe\b|\bpes\b|pedicure/.test(n)) ids.push("pes");
  if (ids.length === 0 && /sobrancelha|buco|cilio|depila/.test(n + " " + c)) ids.push("rosto");
  if (ids.length === 0 && (/cabelo|tratamento|coloracao/.test(c) || /corte|escova|progressiva|botox|tintura|relax|cronograma/.test(n))) ids.push("cabelo");
  if (ids.length === 0) ids.push(/unha/.test(c) ? "maos" : "outros");
  return ids;
}

function precoDe(s: ServicoChat): string {
  return s.temTamanho ? `a partir de ${formatBRL(s.preco)}` : `${formatBRL(s.preco)} · ${formatDuracao(s.duracao)}`;
}

/* ---------- ícones ---------- */
const traco = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...traco}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
function IconeSetaDireita({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} aria-hidden {...traco}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
function IconeCalendario() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...traco}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8.5 14.5l2.2 2.2 4.3-4.4" />
    </svg>
  );
}
function IconeLista() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...traco}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17.5" r="1" />
    </svg>
  );
}

/* ---------- peças das telas ---------- */
function Topo({ titulo, aoVoltar }: { titulo: string; aoVoltar: () => void }) {
  return (
    <header className="no-escuro flex shrink-0 items-center gap-1 bg-ameixa px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-perola">
      <button type="button" onClick={aoVoltar} aria-label="Voltar" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
        <IconeSeta />
      </button>
      <h2 className="min-w-0 flex-1 truncate font-display text-2xl">{titulo}</h2>
    </header>
  );
}

function FotoServico({ s, sizes, className }: { s: ServicoChat; sizes: string; className?: string }) {
  return s.foto ? (
    <Image src={s.foto} alt="" fill sizes={sizes} className={`object-cover ${className ?? ""}`} />
  ) : (
    <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-cha to-blush text-3xl" aria-hidden>
      {emojiServico(s.nome, s.categoria)}
    </span>
  );
}

function Carregando() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <p className="animate-pulse text-suave">Já estou abrindo… 💖</p>
    </div>
  );
}

function ErroDeConexao({ aoTentar }: { aoTentar: () => void }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="font-display text-2xl">Sem conexão 😕</p>
        <p className="mx-auto mt-2 max-w-xs text-suave">Não consegui carregar agora. Confira a internet e tente de novo.</p>
        <button type="button" onClick={aoTentar} className="btn btn-principal mt-5">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

/* ---------- telas ---------- */
function TelaInicial({ aoAgendar, aoServicos, aoSobre }: { aoAgendar: () => void; aoServicos: () => void; aoSobre: () => void }) {
  return (
    <div className="hero-escuro no-escuro flex h-full flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-perola">
      <div className="flex justify-center">
        <Marca tom="claro" link={false} />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        <div style={{ width: "min(100%, calc((var(--alt) - 23rem) * 0.74))", minWidth: "8.5rem" }}>
          <Espelho />
        </div>
      </div>

      <p className="mb-4 text-center font-display text-[1.65rem] italic leading-tight">Hora marcada para cuidar de você.</p>

      <div className="space-y-3">
        <button type="button" onClick={aoAgendar} className="btn btn-ambar !min-h-16 w-full justify-center gap-3 !rounded-2xl !text-lg">
          <IconeCalendario />
          Agendar horário
        </button>
        <button type="button" onClick={aoServicos} className="btn !min-h-16 w-full justify-center gap-3 !rounded-2xl bg-perola !text-lg font-semibold text-ameixa shadow-suave hover:bg-white">
          <IconeLista />
          Ver serviços
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-cha">
        <button type="button" onClick={aoSobre} className="min-h-9 underline-offset-4 hover:text-perola hover:underline">
          Sobre o salão
        </button>
        <Link href="/entrar" className="min-h-9 py-1.5 underline-offset-4 hover:text-perola hover:underline">
          Área da equipe
        </Link>
      </div>
    </div>
  );
}

function TelaServicos({ dados, erro, aoVoltar, aoGrupo, aoTentar }: { dados: DadosChat | null; erro: boolean; aoVoltar: () => void; aoGrupo: (id: string) => void; aoTentar: () => void }) {
  const grupos = dados
    ? GRUPOS.map((g) => ({ g, lista: dados.servicos.filter((s) => gruposDo(s).includes(g.id)) })).filter((x) => x.lista.length > 0)
    : [];
  return (
    <div className="flex h-full flex-col bg-perola">
      <Topo titulo="O que você quer fazer?" aoVoltar={aoVoltar} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        {erro ? <ErroDeConexao aoTentar={aoTentar} /> : !dados ? <Carregando /> : (
          <ul className="space-y-3">
            {grupos.map(({ g, lista }, i) => {
              const capa = lista.find((s) => s.slug === g.preferida) ?? lista.find((s) => s.foto) ?? lista[0];
              return (
                <li key={g.id} className="entrada" style={{ animationDelay: `${120 + i * 60}ms` }}>
                  <button
                    type="button"
                    onClick={() => aoGrupo(g.id)}
                    className="flex w-full items-center gap-4 rounded-3xl border border-linha bg-white p-3 text-left shadow-suave transition active:scale-[0.99]"
                  >
                    <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-blush">
                      <FotoServico s={capa} sizes="80px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.35rem] leading-tight">
                        {g.emoji} {g.chamada}
                      </span>
                      <span className="mt-1 block text-sm text-suave">
                        {lista.length} {lista.length === 1 ? "opção" : "opções"}
                      </span>
                    </span>
                    <IconeSetaDireita className="h-6 w-6 shrink-0 text-framboesa" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TelaGrupo({ id, dados, aoVoltar, aoServico }: { id: string; dados: DadosChat; aoVoltar: () => void; aoServico: (id: string) => void }) {
  const g = GRUPOS.find((x) => x.id === id) ?? GRUPOS[GRUPOS.length - 1];
  const lista = dados.servicos.filter((s) => gruposDo(s).includes(id));
  return (
    <div className="flex h-full flex-col bg-perola">
      <Topo titulo={`${g.emoji} ${g.titulo}`} aoVoltar={aoVoltar} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <ul className="space-y-3">
          {lista.map((s, i) => (
            <li key={s.id} className="entrada" style={{ animationDelay: `${100 + i * 55}ms` }}>
              <button
                type="button"
                onClick={() => aoServico(s.id)}
                className="flex w-full items-center gap-4 rounded-3xl border border-linha bg-white p-3 text-left shadow-suave transition active:scale-[0.99]"
              >
                <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-blush">
                  <FotoServico s={s} sizes="72px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold leading-tight">{s.nome}</span>
                  <span className="tabular mt-1 block text-sm text-suave">{precoDe(s)}</span>
                </span>
                <IconeSetaDireita className="h-6 w-6 shrink-0 text-framboesa" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TelaServico({ id, dados, aoVoltar, aoAgendar }: { id: string; dados: DadosChat; aoVoltar: () => void; aoAgendar: (slug: string) => void }) {
  const s = dados.servicos.find((x) => x.id === id);
  if (!s) return <Carregando />;
  return (
    <div className="flex h-full flex-col bg-perola">
      <Topo titulo={s.nome} aoVoltar={aoVoltar} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-blush">
          <FotoServico s={s} sizes="(min-width:768px) 28rem, 100vw" />
        </div>
        <div className="space-y-6 px-5 pb-6 pt-5">
          <div>
            <p className="text-sm font-medium text-framboesa">{s.categoria}</p>
            <h3 className="mt-1 text-3xl">{s.nome}</h3>
            {s.descricaoLonga || s.descricao ? <p className="mt-3 text-suave">{s.descricaoLonga || s.descricao}</p> : null}
          </div>

          {s.temTamanho ? (
            <table className="tabular w-full text-left text-sm">
              <caption className="sr-only">Valores e tempo por tamanho do cabelo</caption>
              <thead>
                <tr className="border-b border-linha text-suave">
                  <th className="py-2 font-medium">Tamanho</th>
                  <th className="py-2 font-medium">Valor</th>
                  <th className="py-2 font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {s.variacoes.map((v) => (
                  <tr key={v.id} className="border-b border-linha/70">
                    <td className="py-2.5">{ROTULO_TAMANHO[v.tamanho]}</td>
                    <td className="py-2.5 font-semibold">{formatBRL(v.preco)}</td>
                    <td className="py-2.5">{formatDuracao(v.duracao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="tabular flex gap-4 text-lg">
              <span className="font-semibold">{formatBRL(s.preco)}</span>
              <span className="text-suave">{formatDuracao(s.duracao)}</span>
            </p>
          )}

          {s.passos.length > 0 ? (
            <div>
              <h4 className="text-xl">Como é o procedimento</h4>
              <ol className="mt-4 space-y-3.5">
                {s.passos.map((p, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="tabular mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full bg-ameixa text-sm font-semibold text-perola">{i + 1}</span>
                    <span className="pt-0.5 leading-relaxed">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-linha bg-perola px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5">
        <button type="button" onClick={() => aoAgendar(s.slug)} className="btn btn-principal !min-h-14 w-full justify-center gap-2.5 !text-lg">
          <IconeCalendario />
          Agendar este serviço
        </button>
      </div>
    </div>
  );
}

function TelaSobre({ dados, aoVoltar, aoAgendar }: { dados: DadosChat | null; aoVoltar: () => void; aoAgendar: () => void }) {
  const zap = soDigitos(dados?.whatsapp ?? "");
  const insta = dados?.instagram?.replace(/^@/, "").trim();
  return (
    <div className="flex h-full flex-col bg-perola">
      <Topo titulo="Sobre o salão" aoVoltar={aoVoltar} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="relative aspect-[4/5] w-full max-w-xs overflow-hidden rounded-3xl shadow-suave max-md:mx-auto">
          <Image src="/fotos/salao-placa.webp" alt="Eliana no salão, ao lado da placa Espaço Beauty" fill sizes="20rem" className="object-cover" />
        </div>
        <h3 className="mt-6 text-3xl">Um cantinho para relaxar</h3>
        <p className="mt-2 text-suave">Cadeiras confortáveis, luz suave e o cuidado de quem faz com carinho.</p>

        {dados?.endereco ? (
          <section className="mt-6">
            <h4 className="text-lg">Onde fica</h4>
            <p className="mt-1 text-suave">{dados.endereco}</p>
          </section>
        ) : null}
        {dados && dados.horarios.length > 0 ? (
          <section className="mt-6">
            <h4 className="text-lg">Horário</h4>
            <ul className="mt-1 space-y-0.5 text-suave">
              {dados.horarios.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-7 space-y-3">
          {zap.length >= 10 ? (
            <a
              href={`https://wa.me/55${zap}`}
              target="_blank"
              rel="noreferrer"
              className="btn w-full justify-center gap-2.5 bg-ok !min-h-14 text-white shadow-suave hover:brightness-110"
            >
              <IconeZap className="h-5 w-5" />
              Chamar no WhatsApp
            </a>
          ) : null}
          {insta ? (
            <a href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer" className="btn btn-contorno !min-h-14 w-full justify-center">
              Instagram @{insta}
            </a>
          ) : null}
          <button type="button" onClick={aoAgendar} className="btn btn-principal !min-h-14 w-full justify-center">
            Agendar horário
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- a tela inicial, com slides ---------- */
const DURACAO_SAIDA_MS = 520;

export function Inicio() {
  const [dados, setDados] = useState<DadosChat | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [pilha, setPilha] = useState<Item[]>([]);
  const [viewport, setViewport] = useState<{ h: number; top: number } | null>(null);
  const uid = useRef(0);
  const fundo = useRef(0); // quantas telas estão empilhadas (guardado no histórico do navegador)

  /* os serviços carregam logo que a página abre, para "Ver serviços" já estar pronto */
  useEffect(() => {
    let vivo = true;
    carregarDadosChat().then(
      (d) => vivo && setDados(d),
      () => vivo && setErro(true),
    );
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErro(false);
    setTentativa((n) => n + 1);
  }, []);

  const abrir = useCallback((tela: Tela) => {
    fundo.current += 1;
    window.history.pushState({ n: fundo.current }, "");
    setPilha((p) => [...p, { uid: ++uid.current, tela }]);
  }, []);

  const voltar = useCallback(() => {
    if (fundo.current > 0) window.history.back();
  }, []);

  /* o botão "voltar" do celular e do navegador fecha o slide de cima */
  useEffect(() => {
    window.history.replaceState({ n: 0 }, "");
    fundo.current = 0;
    const aoNavegar = (e: PopStateEvent) => {
      const alvo = typeof e.state?.n === "number" ? e.state.n : 0;
      fundo.current = alvo;
      setPilha((p) => {
        let vivos = 0;
        return p.map((it) => {
          if (it.saindo) return it;
          const sai = vivos >= alvo;
          vivos += 1;
          return sai ? { ...it, saindo: true } : it;
        });
      });
    };
    window.addEventListener("popstate", aoNavegar);
    // links antigos para /#servicos abrem direto a lista de serviços
    if (window.location.hash === "#servicos") {
      window.history.replaceState({ n: 0 }, "", window.location.pathname);
      abrir({ tipo: "servicos" });
    }
    return () => window.removeEventListener("popstate", aoNavegar);
  }, [abrir]);

  /* telas que saíram são removidas depois da animação (com reserva, caso a animação não dispare) */
  const temSaindo = pilha.some((i) => i.saindo);
  useEffect(() => {
    if (!temSaindo) return;
    const t = window.setTimeout(() => setPilha((p) => p.filter((i) => !i.saindo)), DURACAO_SAIDA_MS);
    return () => window.clearTimeout(t);
  }, [temSaindo, pilha]);

  /* no celular, quando o teclado abre, a tela acompanha a parte visível */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setViewport(mq.matches ? { h: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null);
    atualizar();
    vv.addEventListener("resize", atualizar);
    vv.addEventListener("scroll", atualizar);
    mq.addEventListener("change", atualizar);
    return () => {
      vv.removeEventListener("resize", atualizar);
      vv.removeEventListener("scroll", atualizar);
      mq.removeEventListener("change", atualizar);
    };
  }, []);

  const vivos = pilha.filter((i) => !i.saindo);
  const topoUid = vivos.length ? vivos[vivos.length - 1].uid : null;

  function conteudo(tela: Tela): ReactNode {
    switch (tela.tipo) {
      case "servicos":
        return <TelaServicos dados={dados} erro={erro} aoVoltar={voltar} aoTentar={tentarDeNovo} aoGrupo={(id) => abrir({ tipo: "grupo", id })} />;
      case "grupo":
        return dados ? <TelaGrupo id={tela.id} dados={dados} aoVoltar={voltar} aoServico={(id) => abrir({ tipo: "servico", id })} /> : <Carregando />;
      case "servico":
        return dados ? <TelaServico id={tela.id} dados={dados} aoVoltar={voltar} aoAgendar={(slug) => abrir({ tipo: "agendar", slug })} /> : <Carregando />;
      case "sobre":
        return <TelaSobre dados={dados} aoVoltar={voltar} aoAgendar={() => abrir({ tipo: "agendar", slug: null })} />;
      case "agendar":
        return dados ? (
          <ChatAgendamento {...dados} slugInicial={tela.slug} embutido aoVoltar={voltar} aoVerServicos={() => abrir({ tipo: "servicos" })} />
        ) : (
          <ChatCarregando embutido erro={erro} aoTentar={tentarDeNovo} aoVoltar={voltar} />
        );
    }
  }

  const baseCoberta = vivos.length > 0;

  return (
    <div
      style={viewport ? { height: viewport.h, top: viewport.top, bottom: "auto" } : undefined}
      className="fixed inset-0 overflow-hidden bg-ameixa [--alt:100dvh] md:static md:mx-auto md:my-6 md:h-[min(52rem,calc(100dvh-3rem))] md:max-w-md md:rounded-[2rem] md:border md:border-linha md:shadow-camarim md:[--alt:min(52rem,calc(100dvh-3rem))]"
    >
      <div className={`tela ${baseCoberta ? "tela-coberta" : ""}`} inert={baseCoberta}>
        <TelaInicial
          aoAgendar={() => abrir({ tipo: "agendar", slug: null })}
          aoServicos={() => abrir({ tipo: "servicos" })}
          aoSobre={() => abrir({ tipo: "sobre" })}
        />
      </div>

      {pilha.map((it) => {
        const coberta = !it.saindo && it.uid !== topoUid;
        return (
          <div
            key={it.uid}
            className={`tela ${it.saindo ? "tela-sai" : "tela-entra"} ${coberta ? "tela-coberta" : ""}`}
            inert={it.saindo || coberta}
          >
            {conteudo(it.tela)}
          </div>
        );
      })}
    </div>
  );
}
