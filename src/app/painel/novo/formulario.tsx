"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { SeletorHorario } from "@/components/seletor-horario";
import { calcularCobranca } from "@/lib/cobranca";
import { dataPorExtenso, formatBRL, formatDuracao, formatTelefone } from "@/lib/tempo";
import { ROTULO_TAMANHO, type Profissional, type Servico } from "@/lib/tipos";
import { buscarClientePorTelefone, criarPelaEquipe, diasLivresEquipe, horasLivresEquipe } from "@/app/painel/novo/actions";

type Forma = "no_local" | "sinal_recebido" | "total_recebido" | "cobrar_pix";

type Props = {
  servicos: Servico[];
  profissionais: Profissional[];
  profissionalFixa: string | null;
  hoje: string;
  maxData: string;
  sinalPct: number;
  mpAtivo: boolean;
  dataInicial: string | null;
  profInicial: string | null;
  siteUrl: string;
};

export function FormularioNovo({ servicos, profissionais, profissionalFixa, hoje, maxData, sinalPct, mpAtivo, dataInicial, profInicial, siteUrl }: Props) {
  const [servicoId, setServicoId] = useState("");
  const [variacaoId, setVariacaoId] = useState<string | null>(null);
  const [profId, setProfId] = useState<string | null>(profissionalFixa ?? profInicial);
  const [horario, setHorario] = useState<{ data: string | null; hora: string | null }>({ data: dataInicial, hora: null });
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [forma, setForma] = useState<Forma>("no_local");
  const [erro, setErro] = useState<string | null>(null);
  const [conhecida, setConhecida] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ token: string; cobrarPix: boolean } | null>(null);
  const [pendente, iniciar] = useTransition();

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const variacao = servico?.variacoes.find((v) => v.id === variacaoId) ?? null;
  const preco = servico ? (servico.tem_tamanho ? (variacao?.preco ?? 0) : servico.preco_base) : 0;
  const duracao = servico ? (servico.tem_tamanho ? (variacao?.duracao_min ?? 0) : servico.duracao_min) : 0;
  const pronto = !!servico && (!servico.tem_tamanho || !!variacao);

  const elegiveis = useMemo(
    () => (servico ? profissionais.filter((p) => servico.profissionais.includes(p.id) && (!profissionalFixa || p.id === profissionalFixa)) : []),
    [servico, profissionais, profissionalFixa],
  );
  const profEfetiva = profId && elegiveis.some((p) => p.id === profId) ? profId : elegiveis.length === 1 ? elegiveis[0].id : null;

  const categorias = useMemo(() => {
    const m = new Map<string, Servico[]>();
    for (const s of servicos) m.set(s.categoria, [...(m.get(s.categoria) ?? []), s]);
    return [...m.entries()];
  }, [servicos]);

  const buscarDias = useCallback(
    (p: { ano: number; mes: number; profissionalId: string | null }) =>
      servico && pronto
        ? diasLivresEquipe({ servicoId: servico.id, variacaoId, profissionalId: p.profissionalId, ano: p.ano, mes: p.mes })
        : Promise.resolve([]),
    [servico, pronto, variacaoId],
  );
  const buscarHoras = useCallback(
    (p: { data: string; profissionalId: string | null }) =>
      servico && pronto ? horasLivresEquipe({ servicoId: servico.id, variacaoId, profissionalId: p.profissionalId, data: p.data }) : Promise.resolve([]),
    [servico, pronto, variacaoId],
  );

  function aoDigitarTelefone(v: string) {
    const f = formatTelefone(v);
    setTelefone(f);
    setConhecida(null);
    const d = f.replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) {
      buscarClientePorTelefone(d).then((c) => {
        if (c) {
          setNome((n) => n || c.nome);
          setEmail((e) => e || c.email || "");
          setConhecida(c.nome);
        }
      });
    }
  }

  const sinal = calcularCobranca(preco, "sinal", sinalPct);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!servico || !pronto) return setErro("Escolha o serviço (e o tamanho, se houver).");
    if (!horario.data || !horario.hora) return setErro("Escolha o dia e o horário.");
    iniciar(async () => {
      const r = await criarPelaEquipe({
        servicoId: servico.id,
        variacaoId,
        profissionalId: profEfetiva,
        data: horario.data!,
        hora: horario.hora!,
        nome,
        telefone,
        email,
        forma,
        observacoes: obs,
      });
      if (!r.ok) setErro(r.erro);
      else setFeito({ token: r.token, cobrarPix: r.cobrarPix });
    });
  }

  if (feito) {
    const link = `${siteUrl}/reserva/${feito.token}`;
    const fone = telefone.replace(/\D/g, "");
    const msg = feito.cobrarPix
      ? `Olá, ${nome.split(" ")[0]}! Seu horário no Espaço Beauty está reservado. Para confirmar, pague o PIX por este link: ${link}`
      : `Olá, ${nome.split(" ")[0]}! Seu horário no Espaço Beauty está confirmado. Veja os detalhes, remarque ou cancele por aqui: ${link}`;
    return (
      <div className="cartao max-w-2xl space-y-5 p-8">
        <span className="lampada" style={{ ["--d" as string]: "16px" } as React.CSSProperties} aria-hidden />
        <h2 className="text-4xl">{feito.cobrarPix ? "Horário segurado" : "Agendamento criado"}</h2>
        <p className="text-suave">
          {feito.cobrarPix
            ? "O horário fica reservado até a cliente pagar o PIX. Envie o link para ela."
            : "Já está na agenda. Envie o link para a cliente poder ver, remarcar ou cancelar."}
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-principal" target="_blank" rel="noreferrer" href={`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`}>
            Enviar pelo WhatsApp
          </a>
          <button type="button" className="btn btn-contorno" onClick={() => navigator.clipboard?.writeText(link)}>
            Copiar link
          </button>
          <Link href={`/painel/agenda?data=${horario.data}`} className="btn btn-quieto">
            Ver na agenda
          </Link>
        </div>
        <button type="button" className="text-sm font-semibold text-framboesa underline underline-offset-4" onClick={() => window.location.reload()}>
          Fazer outro agendamento
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-10">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-2xl">1. Serviço</legend>
          <div>
            <label htmlFor="n-servico" className="rotulo">
              Serviço
            </label>
            <select
              id="n-servico"
              className="campo"
              value={servicoId}
              onChange={(e) => {
                setServicoId(e.target.value);
                setVariacaoId(null);
                setHorario((h) => ({ ...h, hora: null }));
              }}
              required
            >
              <option value="">Escolha…</option>
              {categorias.map(([cat, lista]) => (
                <optgroup key={cat} label={cat}>
                  {lista.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {servico?.tem_tamanho ? (
            <div>
              <span className="rotulo">Tamanho do cabelo</span>
              <div className="flex flex-wrap gap-2">
                {servico.variacoes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={variacaoId === v.id}
                    onClick={() => {
                      setVariacaoId(v.id);
                      setHorario((h) => ({ ...h, hora: null }));
                    }}
                    className={`rounded-2xl border-[1.5px] px-4 py-2.5 text-left text-sm transition ${
                      variacaoId === v.id ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white hover:border-framboesa"
                    }`}
                  >
                    <span className="block font-semibold">{ROTULO_TAMANHO[v.tamanho]}</span>
                    <span className="tabular block opacity-80">
                      {formatBRL(v.preco)} · {formatDuracao(v.duracao_min)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {servico && elegiveis.length > 1 && !profissionalFixa ? (
            <div>
              <label htmlFor="n-prof" className="rotulo">
                Profissional
              </label>
              <select id="n-prof" className="campo" value={profId ?? ""} onChange={(e) => setProfId(e.target.value || null)}>
                <option value="">Qualquer uma disponível</option>
                {elegiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {servico && elegiveis.length === 0 ? (
            <p role="alert" className="text-sm font-medium text-erro">
              Nenhuma profissional ativa faz este serviço. Ajuste em Serviços.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4" disabled={!pronto || elegiveis.length === 0}>
          <legend className="mb-2 text-2xl">2. Dia e horário</legend>
          {pronto ? (
            <SeletorHorario
              hoje={hoje}
              maxData={maxData}
              profissionalId={profEfetiva}
              data={horario.data}
              hora={horario.hora}
              onChange={setHorario}
              buscarDias={buscarDias}
              buscarHoras={buscarHoras}
              chave={`${servicoId}|${variacaoId}|${profEfetiva}`}
            />
          ) : (
            <p className="text-suave">Escolha o serviço para ver os horários livres.</p>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-2xl">3. Cliente</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="n-tel" className="rotulo">
                WhatsApp
              </label>
              <input id="n-tel" className="campo tabular" inputMode="tel" autoComplete="off" placeholder="(11) 90000-0000" value={telefone} onChange={(e) => aoDigitarTelefone(e.target.value)} required />
              {conhecida ? <p className="ajuda">Cliente já cadastrada: {conhecida}.</p> : null}
            </div>
            <div>
              <label htmlFor="n-nome" className="rotulo">
                Nome
              </label>
              <input id="n-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="n-email" className="rotulo">
                E-mail (opcional{mpAtivo ? ", necessário para PIX automático" : ""})
              </label>
              <input id="n-email" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="n-obs" className="rotulo">
                Observações
              </label>
              <textarea id="n-obs" className="campo" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={600} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-2xl">4. Pagamento</legend>
          {(
            [
              ["no_local", "Paga no dia", "Nada recebido agora. O horário já fica confirmado."],
              ["sinal_recebido", `Sinal já recebido (${sinalPct}%)`, preco ? `Registra ${formatBRL(sinal)} como pago.` : ""],
              ["total_recebido", "Valor total já recebido", preco ? `Registra ${formatBRL(preco)} como pago.` : ""],
              ["cobrar_pix", "Cobrar por PIX", mpAtivo ? "Gera o PIX automático e segura o horário até pagar." : "Segura o horário e manda o link com a chave PIX."],
            ] as [Forma, string, string][]
          ).map(([v, t, d]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 transition ${forma === v ? "border-ameixa bg-white" : "border-linha bg-white/60 hover:border-framboesa"}`}>
              <input type="radio" name="forma" value={v} checked={forma === v} onChange={() => setForma(v)} className="mt-1 accent-[#a8325a]" />
              <span>
                <span className="block font-semibold">{t}</span>
                {d ? <span className="block text-sm text-suave">{d}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="cartao space-y-4 p-6">
          <h2 className="text-2xl">Resumo</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-suave">Serviço</dt>
              <dd>{servico ? `${servico.nome}${variacao ? ` · ${ROTULO_TAMANHO[variacao.tamanho]}` : ""}` : "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-suave">Quando</dt>
              <dd className="first-letter:uppercase">{horario.data ? `${dataPorExtenso(horario.data)}${horario.hora ? `, ${horario.hora}` : ""}` : "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-suave">Duração</dt>
              <dd>{duracao ? formatDuracao(duracao) : "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-suave">Valor</dt>
              <dd className="tabular font-display text-3xl">{preco ? formatBRL(preco) : "—"}</dd>
            </div>
          </dl>
          {erro ? (
            <p role="alert" className="text-sm font-medium text-erro">
              {erro}
            </p>
          ) : null}
          <button type="submit" className="btn btn-principal w-full" disabled={pendente}>
            {pendente ? "Salvando…" : "Criar agendamento"}
          </button>
        </div>
      </aside>
    </form>
  );
}
