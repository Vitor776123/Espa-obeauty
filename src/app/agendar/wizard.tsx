"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeletorHorario } from "@/components/seletor-horario";
import { buscarDiasLivres, buscarHorasLivres, criarReservaPublica } from "@/app/agendar/actions";
import { dataPorExtenso, formatBRL, formatDuracao, formatTelefone } from "@/lib/tempo";
import { ROTULO_TAMANHO, type Tamanho } from "@/lib/tipos";

export type ServicoWizard = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  descricao: string;
  temTamanho: boolean;
  preco: number;
  duracao: number;
  variacoes: { id: string; tamanho: Tamanho; preco: number; duracao: number }[];
  profissionais: string[];
};

type Props = {
  servicos: ServicoWizard[];
  profissionais: { id: string; nome: string }[];
  hoje: string;
  maxData: string;
  sinalPct: number;
  holdMinutos: number;
  exigeEmail: boolean;
  slugInicial: string | null;
};

const PASSOS = ["Serviço", "Horário", "Seus dados", "Confirmar"];

function Progresso({ atual }: { atual: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Etapas do agendamento">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-2 sm:gap-3" aria-current={i === atual ? "step" : undefined}>
          <span
            className={`lampada ${i <= atual ? "" : "lampada-apagada"}`}
            style={{ ["--d" as string]: "12px" } as React.CSSProperties}
            aria-hidden
          />
          <span className={`text-sm ${i === atual ? "font-semibold" : "hidden text-suave sm:inline"}`}>{p}</span>
          {i < PASSOS.length - 1 ? <span aria-hidden className="hidden h-px w-5 bg-linha sm:block" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function Wizard(props: Props) {
  const { servicos, profissionais, hoje, maxData, sinalPct, holdMinutos, exigeEmail } = props;
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const inicial = servicos.find((s) => s.slug === props.slugInicial) ?? null;
  const [passo, setPasso] = useState(inicial ? (inicial.temTamanho ? 0 : 1) : 0);
  const [servicoId, setServicoId] = useState<string | null>(inicial?.id ?? null);
  const [variacaoId, setVariacaoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string>("Todos");
  const [profId, setProfId] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<"sinal" | "total">("sinal");
  const [erro, setErro] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const variacao = servico?.variacoes.find((v) => v.id === variacaoId) ?? null;
  const preco = variacao?.preco ?? servico?.preco ?? 0;
  const duracao = variacao?.duracao ?? servico?.duracao ?? 0;
  const sinal = Math.round(preco * sinalPct) / 100;
  const cobranca = tipo === "sinal" ? sinal : preco;
  const profsDoServico = useMemo(
    () => (servico ? profissionais.filter((p) => servico.profissionais.includes(p.id)) : []),
    [servico, profissionais],
  );
  const prof = profsDoServico.find((p) => p.id === profId) ?? null;
  const categorias = useMemo(() => ["Todos", ...Array.from(new Set(servicos.map((s) => s.categoria)))], [servicos]);

  const servicoPronto = Boolean(servico && (!servico.temTamanho || variacao));
  const horarioPronto = Boolean(data && hora);
  const dadosProntos =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    (!exigeEmail || /^\S+@\S+\.\S+$/.test(email)) &&
    (email === "" || /^\S+@\S+\.\S+$/.test(email));

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [passo]);

  const buscarDias = useCallback(
    ({ ano, mes, profissionalId }: { ano: number; mes: number; profissionalId: string | null }) =>
      buscarDiasLivres({ servicoId: servicoId!, variacaoId, profissionalId, ano, mes }),
    [servicoId, variacaoId],
  );
  const buscarHoras = useCallback(
    ({ data, profissionalId }: { data: string; profissionalId: string | null }) =>
      buscarHorasLivres({ servicoId: servicoId!, variacaoId, profissionalId, data }),
    [servicoId, variacaoId],
  );

  function escolherServico(s: ServicoWizard) {
    setServicoId(s.id);
    setVariacaoId(null);
    setProfId(null);
    setData(null);
    setHora(null);
    if (!s.temTamanho) setPasso(1);
  }

  function enviar() {
    if (!servico || !data || !hora) return;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await criarReservaPublica({
          servicoId: servico.id,
          variacaoId,
          profissionalId: profId,
          data,
          hora,
          nome,
          telefone,
          email,
          tipoPagamento: tipo,
        });
        if (r.ok) router.push(`/reserva/${r.token}`);
        else {
          setErro(r.erro);
          if (/horário/i.test(r.erro)) {
            setHora(null);
            setPasso(1);
          }
        }
      } catch {
        setErro("Algo deu errado ao reservar. Tente de novo.");
      }
    });
  }

  const resumo = (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-suave">Serviço</dt>
        <dd className="font-semibold">{servico ? servico.nome : "—"}</dd>
        {variacao ? <dd className="text-suave">{ROTULO_TAMANHO[variacao.tamanho]}</dd> : null}
      </div>
      <div>
        <dt className="text-suave">Quando</dt>
        <dd className="font-semibold first-letter:uppercase">{data ? dataPorExtenso(data) : "—"}</dd>
        {hora ? <dd className="tabular text-suave">às {hora}{duracao ? ` · ${formatDuracao(duracao)}` : ""}</dd> : null}
      </div>
      {prof || (profsDoServico.length > 1 && horarioPronto) ? (
        <div>
          <dt className="text-suave">Com</dt>
          <dd className="font-semibold">{prof ? prof.nome : "Quem estiver livre"}</dd>
        </div>
      ) : null}
      <div className="border-t border-linha pt-3">
        <dt className="text-suave">Valor</dt>
        <dd className="tabular font-display text-3xl">{servico ? formatBRL(preco) : "—"}</dd>
      </div>
    </dl>
  );

  return (
    <div className="container-site py-6 md:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Progresso atual={passo} />
        {passo > 0 ? (
          <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => setPasso(passo - 1)}>
            Voltar
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="min-w-0">
          {passo === 0 && (
            <section aria-labelledby="t0">
              <h1 id="t0" ref={titulo} tabIndex={-1} className="text-4xl outline-none sm:text-5xl">
                Qual serviço você quer?
              </h1>
              <div className="sem-barra -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Categorias">
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={categoria === c}
                    onClick={() => setCategoria(c)}
                    className={`btn btn-pequeno shrink-0 border-[1.5px] ${
                      categoria === c ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white hover:border-ameixa"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {servicos
                  .filter((s) => categoria === "Todos" || s.categoria === categoria)
                  .map((s) => {
                    const sel = s.id === servicoId;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={sel}
                          onClick={() => escolherServico(s)}
                          className={`block h-full w-full rounded-2xl border-[1.5px] p-4 text-left transition ${
                            sel ? "border-framboesa bg-cha-claro" : "border-linha bg-white hover:border-ameixa/50"
                          }`}
                        >
                          <span className="block font-display text-xl leading-tight">{s.nome}</span>
                          <span className="mt-1 block text-sm text-suave">{s.descricao}</span>
                          <span className="tabular mt-3 flex gap-3 text-sm">
                            <span className="font-semibold">
                              {s.temTamanho ? "a partir de " : ""}
                              {formatBRL(s.preco)}
                            </span>
                            <span className="text-suave">
                              {s.temTamanho ? "varia com o cabelo" : formatDuracao(s.duracao)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>

              {servico?.temTamanho ? (
                <div className="mt-8 rounded-2xl border border-linha bg-white p-5">
                  <h2 className="text-2xl">Qual o comprimento do cabelo?</h2>
                  <p className="mt-1 text-sm text-suave">O valor e o tempo mudam com o comprimento.</p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                    {servico.variacoes.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          aria-pressed={v.id === variacaoId}
                          onClick={() => {
                            setVariacaoId(v.id);
                            setData(null);
                            setHora(null);
                          }}
                          className={`w-full rounded-xl border-[1.5px] p-4 text-left transition ${
                            v.id === variacaoId ? "border-framboesa bg-cha-claro" : "border-linha hover:border-ameixa/50"
                          }`}
                        >
                          <span className="block font-semibold">{ROTULO_TAMANHO[v.tamanho]}</span>
                          <span className="tabular mt-1 block font-display text-2xl">{formatBRL(v.preco)}</span>
                          <span className="tabular block text-sm text-suave">{formatDuracao(v.duracao)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-8 sticky bottom-0 z-20 -mx-5 border-t border-linha bg-perola/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                <button type="button" className="btn btn-principal w-full sm:w-auto" disabled={!servicoPronto} onClick={() => setPasso(1)}>
                  Continuar
                </button>
              </div>
            </section>
          )}

          {passo === 1 && servico && (
            <section aria-labelledby="t1">
              <h1 id="t1" ref={titulo} tabIndex={-1} className="text-4xl outline-none sm:text-5xl">
                Quando fica bom pra você?
              </h1>
              {profsDoServico.length > 1 ? (
                <div className="mt-6">
                  <p className="rotulo">Com quem?</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Profissional">
                    {[{ id: null as string | null, nome: "Quem estiver livre" }, ...profsDoServico].map((p) => (
                      <button
                        key={p.id ?? "qualquer"}
                        type="button"
                        aria-pressed={profId === p.id}
                        onClick={() => {
                          setProfId(p.id);
                          setData(null);
                          setHora(null);
                        }}
                        className={`btn btn-pequeno border-[1.5px] ${
                          profId === p.id ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white hover:border-ameixa"
                        }`}
                      >
                        {p.nome}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-8">
                <SeletorHorario
                  hoje={hoje}
                  maxData={maxData}
                  profissionalId={profId}
                  data={data}
                  hora={hora}
                  onChange={(v) => {
                    setData(v.data);
                    setHora(v.hora);
                  }}
                  buscarDias={buscarDias}
                  buscarHoras={buscarHoras}
                  chave={`${servicoId}-${variacaoId}`}
                />
              </div>
              <div className="mt-8 sticky bottom-0 z-20 -mx-5 border-t border-linha bg-perola/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                <button type="button" className="btn btn-principal w-full sm:w-auto" disabled={!horarioPronto} onClick={() => setPasso(2)}>
                  Continuar
                </button>
              </div>
            </section>
          )}

          {passo === 2 && (
            <section aria-labelledby="t2">
              <h1 id="t2" ref={titulo} tabIndex={-1} className="text-4xl outline-none sm:text-5xl">
                Seus dados
              </h1>
              <form
                className="mt-6 max-w-md space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dadosProntos) setPasso(3);
                }}
              >
                <div>
                  <label className="rotulo" htmlFor="nome">
                    Nome completo
                  </label>
                  <input id="nome" className="campo" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div>
                  <label className="rotulo" htmlFor="tel">
                    Telefone com DDD
                  </label>
                  <input
                    id="tel"
                    className="campo tabular"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(11) 91234-5678"
                    value={telefone}
                    onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                    required
                  />
                  <p className="ajuda">É com ele que a gente identifica suas reservas.</p>
                </div>
                <div>
                  <label className="rotulo" htmlFor="email">
                    E-mail {exigeEmail ? "" : "(opcional)"}
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="campo"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    required={exigeEmail}
                  />
                  {exigeEmail ? <p className="ajuda">Necessário para gerar o PIX.</p> : null}
                </div>
                <button type="submit" className="btn btn-principal w-full sm:w-auto" disabled={!dadosProntos}>
                  Continuar
                </button>
              </form>
            </section>
          )}

          {passo === 3 && servico && data && hora && (
            <section aria-labelledby="t3">
              <h1 id="t3" ref={titulo} tabIndex={-1} className="text-4xl outline-none sm:text-5xl">
                Confirmar e garantir o horário
              </h1>

              <fieldset className="mt-6 max-w-lg">
                <legend className="rotulo">Como você quer pagar?</legend>
                <div className="space-y-3">
                  {sinalPct > 0 && sinalPct < 100 ? (
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-[1.5px] p-4 transition ${
                        tipo === "sinal" ? "border-framboesa bg-cha-claro" : "border-linha bg-white"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input type="radio" name="tipo" className="mt-1.5 accent-[var(--color-framboesa)]" checked={tipo === "sinal"} onChange={() => setTipo("sinal")} />
                        <span>
                          <span className="block font-semibold">Sinal de {sinalPct}%</span>
                          <span className="block text-sm text-suave">O restante você paga no salão. O sinal não é devolvido se cancelar.</span>
                        </span>
                      </span>
                      <span className="tabular font-display text-2xl">{formatBRL(sinal)}</span>
                    </label>
                  ) : null}
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-[1.5px] p-4 transition ${
                      tipo === "total" || sinalPct <= 0 || sinalPct >= 100 ? "border-framboesa bg-cha-claro" : "border-linha bg-white"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="tipo"
                        className="mt-1.5 accent-[var(--color-framboesa)]"
                        checked={tipo === "total" || sinalPct <= 0 || sinalPct >= 100}
                        onChange={() => setTipo("total")}
                      />
                      <span>
                        <span className="block font-semibold">Valor total</span>
                        <span className="block text-sm text-suave">Chega e é só ser atendida.</span>
                      </span>
                    </span>
                    <span className="tabular font-display text-2xl">{formatBRL(preco)}</span>
                  </label>
                </div>
              </fieldset>

              <div className="mt-6 max-w-lg rounded-2xl bg-cha-claro p-5 text-sm">
                <p>
                  <strong>{nome.trim()}</strong>, seu horário fica reservado por {holdMinutos} minutos enquanto você paga por PIX na próxima tela.
                </p>
              </div>

              {erro ? (
                <p role="alert" className="mt-5 max-w-lg rounded-xl bg-[#fbe3e1] p-4 text-sm font-medium text-[#8c1d17]">
                  {erro}
                </p>
              ) : null}

              <div className="mt-8 sticky bottom-0 z-20 -mx-5 border-t border-linha bg-perola/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                <button type="button" className="btn btn-principal w-full sm:w-auto" onClick={enviar} disabled={enviando}>
                  {enviando ? "Reservando…" : `Reservar e pagar ${formatBRL(sinalPct <= 0 || sinalPct >= 100 ? preco : cobranca)}`}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="cartao p-5">
            <h2 className="mb-4 font-sans text-sm font-semibold text-suave">Sua reserva</h2>
            {resumo}
          </div>
        </aside>
      </div>
    </div>
  );
}
