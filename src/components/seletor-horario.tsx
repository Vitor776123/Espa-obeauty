"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dataPorExtenso, diaDaSemana, nomeMes } from "@/lib/tempo";

export type BuscaDias = (p: { ano: number; mes: number; profissionalId: string | null }) => Promise<string[]>;
export type BuscaHoras = (p: { data: string; profissionalId: string | null }) => Promise<string[]>;

type Props = {
  hoje: string; // YYYY-MM-DD (São Paulo)
  maxData: string;
  profissionalId: string | null;
  data: string | null;
  hora: string | null;
  onChange: (v: { data: string | null; hora: string | null }) => void;
  buscarDias: BuscaDias;
  buscarHoras: BuscaHoras;
  /** muda quando serviço/tamanho muda, para recarregar a disponibilidade */
  chave: string;
};

const SEMANA = [
  ["D", "domingo"],
  ["S", "segunda-feira"],
  ["T", "terça-feira"],
  ["Q", "quarta-feira"],
  ["Q", "quinta-feira"],
  ["S", "sexta-feira"],
  ["S", "sábado"],
];

function primeiroDoMes(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}
function diasNoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function GrupoHoras({
  titulo,
  lista,
  hora,
  onEscolher,
}: {
  titulo: string;
  lista: string[];
  hora: string | null;
  onEscolher: (h: string) => void;
}) {
  if (!lista.length) return null;
  return (
    <div>
      <h4 className="mb-2 font-sans text-sm font-semibold text-suave">{titulo}</h4>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {lista.map((h) => {
          const sel = h === hora;
          return (
            <li key={h}>
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => onEscolher(h)}
                className={`tabular flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] px-3 text-[0.95rem] font-semibold transition ${
                  sel
                    ? "border-ameixa bg-ameixa text-perola shadow-suave"
                    : "border-linha bg-white hover:border-framboesa hover:text-framboesa"
                }`}
              >
                <span
                  className={`lampada ${sel ? "" : "lampada-apagada"}`}
                  style={{ ["--d" as string]: "9px" } as React.CSSProperties}
                  aria-hidden
                />
                {h}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SeletorHorario({ hoje, maxData, profissionalId, data, hora, onChange, buscarDias, buscarHoras, chave }: Props) {
  const [anoHoje, mesHoje] = hoje.split("-").map(Number);
  const [anoMax, mesMax] = maxData.split("-").map(Number);
  const inicial = data ? data.split("-").map(Number) : [anoHoje, mesHoje];
  const [ano, setAno] = useState(inicial[0]);
  const [mes, setMes] = useState(inicial[1]);
  const [diasLivres, setDiasLivres] = useState<Set<string> | null>(null);
  const [horas, setHoras] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const seqDias = useRef(0);
  const seqHoras = useRef(0);
  const blocoHoras = useRef<HTMLDivElement>(null);

  // dias livres do mês
  useEffect(() => {
    const id = ++seqDias.current;
    setDiasLivres(null);
    setErro(null);
    buscarDias({ ano, mes, profissionalId })
      .then((l) => {
        if (id === seqDias.current) setDiasLivres(new Set(l));
      })
      .catch(() => {
        if (id === seqDias.current) {
          setDiasLivres(new Set());
          setErro("Não foi possível carregar a agenda. Tente de novo em instantes.");
        }
      });
  }, [ano, mes, profissionalId, chave, buscarDias]);

  // horários do dia escolhido
  useEffect(() => {
    if (!data) {
      setHoras(null);
      return;
    }
    const id = ++seqHoras.current;
    setHoras(null);
    buscarHoras({ data, profissionalId })
      .then((l) => {
        if (id === seqHoras.current) setHoras(l);
      })
      .catch(() => {
        if (id === seqHoras.current) {
          setHoras([]);
          setErro("Não foi possível carregar os horários. Tente de novo.");
        }
      });
  }, [data, profissionalId, chave, buscarHoras]);

  const celulas = useMemo(() => {
    const offset = diaDaSemana(primeiroDoMes(ano, mes));
    const total = diasNoMes(ano, mes);
    const lista: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) lista.push(`${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    while (lista.length % 7) lista.push(null);
    return lista;
  }, [ano, mes]);

  const podeVoltar = ano > anoHoje || (ano === anoHoje && mes > mesHoje);
  const podeAvancar = ano < anoMax || (ano === anoMax && mes < mesMax);

  function mover(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 1) {
      m = 12;
      a--;
    }
    if (m > 12) {
      m = 1;
      a++;
    }
    setAno(a);
    setMes(m);
  }

  const manha = horas?.filter((h) => h < "12:00") ?? [];
  const tarde = horas?.filter((h) => h >= "12:00" && h < "18:00") ?? [];
  const noite = horas?.filter((h) => h >= "18:00") ?? [];

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-10">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-2xl capitalize">
            {nomeMes(mes - 1)} <span className="tabular text-suave">{ano}</span>
          </h3>
          <div className="flex gap-1">
            <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => mover(-1)} disabled={!podeVoltar} aria-label="Mês anterior">
              ‹
            </button>
            <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => mover(1)} disabled={!podeAvancar} aria-label="Próximo mês">
              ›
            </button>
          </div>
        </div>

        <div role="grid" aria-label={`Dias de ${nomeMes(mes - 1)} de ${ano}`} className="grid grid-cols-7 gap-y-1.5 text-center">
          {SEMANA.map(([l, n], i) => (
            <span key={i} role="columnheader" aria-label={n} className="pb-1 text-xs font-semibold text-suave">
              {l}
            </span>
          ))}
          {celulas.map((d, i) => {
            if (!d) return <span key={i} />;
            const livre = diasLivres?.has(d) ?? false;
            const sel = d === data;
            const ehHoje = d === hoje;
            const dia = Number(d.slice(8));
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                disabled={!livre}
                aria-selected={sel}
                aria-label={`${dataPorExtenso(d)}${livre ? "" : ", sem horários"}`}
                onClick={() => {
                  onChange({ data: d, hora: null });
                  // no celular, leva a pessoa até os horários
                  requestAnimationFrame(() => blocoHoras.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
                }}
                className={`tabular mx-auto grid h-11 w-11 place-items-center rounded-full text-[0.95rem] transition ${
                  sel
                    ? "bg-framboesa font-bold text-white shadow-suave"
                    : livre
                      ? "font-semibold hover:bg-cha-claro"
                      : "cursor-not-allowed text-suave/45"
                } ${ehHoje && !sel ? "outline outline-1 -outline-offset-1 outline-ameixa/50" : ""}`}
              >
                {dia}
              </button>
            );
          })}
        </div>
        {diasLivres === null ? <p className="mt-3 text-sm text-suave">Carregando agenda…</p> : null}
        {diasLivres && diasLivres.size === 0 && !erro ? (
          <p className="mt-3 text-sm text-suave">Sem horários livres neste mês. Veja o mês seguinte.</p>
        ) : null}
        {erro ? (
          <p role="alert" className="mt-3 text-sm font-medium text-erro">
            {erro}
          </p>
        ) : null}
      </div>

      <div ref={blocoHoras} aria-live="polite" className="scroll-mt-4">
        {!data ? (
          <div className="grid h-full min-h-40 place-items-center rounded-2xl border border-dashed border-linha p-6 text-center text-suave">
            Escolha um dia para ver os horários livres.
          </div>
        ) : (
          <div>
            <h3 className="mb-4 font-display text-2xl first-letter:uppercase">{dataPorExtenso(data)}</h3>
            {horas === null ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-full bg-cha-claro" />
                ))}
              </div>
            ) : horas.length === 0 ? (
              <p className="text-suave">
                Esse dia ficou sem horários.{" "}
                <button type="button" className="font-semibold text-framboesa underline underline-offset-4" onClick={() => onChange({ data: null, hora: null })}>
                  Escolher outro dia
                </button>
              </p>
            ) : (
              <div className="space-y-5">
                <GrupoHoras titulo="Manhã" lista={manha} hora={hora} onEscolher={(h) => onChange({ data, hora: h })} />
                <GrupoHoras titulo="Tarde" lista={tarde} hora={hora} onEscolher={(h) => onChange({ data, hora: h })} />
                <GrupoHoras titulo="Noite" lista={noite} hora={hora} onEscolher={(h) => onChange({ data, hora: h })} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

