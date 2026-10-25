"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { nomeDia } from "@/lib/tempo";
import type { Horario, Profissional } from "@/lib/tipos";
import { excluirProfissional, salvarProfissional } from "@/app/painel/profissionais/actions";

type Dia = { trabalha: boolean; inicio: string; fim: string; almocoInicio: string; almocoFim: string };
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const CORES = ["#A8325A", "#7B3F98", "#2F6F8F", "#2F7A57", "#B5651D", "#C2410C", "#475569"];

export function FormularioProfissional({
  prof,
  horarios,
  servicos,
  proximaOrdem,
}: {
  prof: Profissional | null;
  horarios: Horario[];
  servicos: { id: string; nome: string; categoria: string; faz: boolean }[];
  proximaOrdem: number;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(prof?.nome ?? "");
  const [bio, setBio] = useState(prof?.bio ?? "");
  const [cor, setCor] = useState(prof?.cor ?? CORES[0]);
  const [ativo, setAtivo] = useState(prof?.ativo ?? true);
  const [ordem, setOrdem] = useState(String(prof?.ordem ?? proximaOrdem));
  const [fazem, setFazem] = useState<string[]>(servicos.filter((s) => s.faz).map((s) => s.id));
  const [dias, setDias] = useState<Dia[]>(() =>
    Array.from({ length: 7 }, (_, d) => {
      const h = horarios.find((x) => x.dia_semana === d);
      if (h) return { trabalha: true, inicio: h.inicio, fim: h.fim, almocoInicio: h.almoco_inicio ?? "", almocoFim: h.almoco_fim ?? "" };
      const util = d >= 1 && d <= 6 && !prof;
      return { trabalha: util, inicio: "09:00", fim: "18:00", almocoInicio: "", almocoFim: "" };
    }),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [confirma, setConfirma] = useState(false);

  const mudaDia = (d: number, p: Partial<Dia>) => setDias((l) => l.map((x, i) => (i === d ? { ...x, ...p } : x)));

  function copiarParaTodos(d: number) {
    const o = dias[d];
    setDias((l) => l.map((x) => (x.trabalha ? { ...x, inicio: o.inicio, fim: o.fim, almocoInicio: o.almocoInicio, almocoFim: o.almocoFim } : x)));
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarProfissional({
        id: prof?.id ?? null,
        nome,
        bio: bio || null,
        cor,
        ativo,
        ordem: Number(ordem) || 0,
        servicos: fazem,
        horarios: dias.map((x, d) => ({
          dia: d,
          trabalha: x.trabalha,
          inicio: x.inicio || "09:00",
          fim: x.fim || "18:00",
          almocoInicio: x.almocoInicio || null,
          almocoFim: x.almocoFim || null,
        })),
      });
      if (!r.ok) return setErro(r.erro);
      router.push("/painel/profissionais");
      router.refresh();
    });
  }

  function excluir() {
    if (!prof) return;
    iniciar(async () => {
      const r = await excluirProfissional(prof.id);
      if (!r.ok) {
        setConfirma(false);
        return setErro(r.erro);
      }
      router.push("/painel/profissionais");
      router.refresh();
    });
  }

  const categorias = [...new Set(servicos.map((s) => s.categoria))];

  return (
    <form onSubmit={salvar} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl">Dados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-nome" className="rotulo">Nome</label>
            <input id="p-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
          </div>
          <div>
            <span className="rotulo">Cor na agenda</span>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor na agenda">
              {CORES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor.toLowerCase() === c.toLowerCase()} aria-label={`Cor ${c}`} onClick={() => setCor(c)} className="h-9 w-9 rounded-full outline-offset-2 transition" style={{ background: c, outline: cor.toLowerCase() === c.toLowerCase() ? "3px solid #3b1526" : "none" }} />
              ))}
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="p-bio" className="rotulo">Apresentação (opcional)</label>
          <textarea id="p-bio" className="campo" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#a8325a]" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Atende clientes (ativa)
          </label>
          <div>
            <label htmlFor="p-ordem" className="rotulo">Ordem</label>
            <input id="p-ordem" className="campo tabular !w-24" inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Horário de trabalho</h2>
        <p className="text-sm text-suave">Marque os dias em que ela atende. O almoço é opcional e não abre horários para clientes.</p>
        <ul className="space-y-2.5">
          {ORDEM_DIAS.map((d) => {
            const x = dias[d];
            return (
              <li key={d} className="grid items-end gap-3 rounded-2xl border border-linha bg-white p-4 sm:grid-cols-[9rem_repeat(4,1fr)_auto]">
                <label className="flex items-center gap-2 font-semibold capitalize">
                  <input type="checkbox" className="h-5 w-5 accent-[#a8325a]" checked={x.trabalha} onChange={(e) => mudaDia(d, { trabalha: e.target.checked })} />
                  {nomeDia(d).replace("-feira", "")}
                </label>
                {(
                  [
                    ["inicio", "Entrada"],
                    ["fim", "Saída"],
                    ["almocoInicio", "Almoço de"],
                    ["almocoFim", "Almoço até"],
                  ] as [keyof Dia, string][]
                ).map(([k, rot]) => (
                  <div key={k}>
                    <label htmlFor={`h-${d}-${k}`} className="rotulo">{rot}</label>
                    <input id={`h-${d}-${k}`} type="time" className="campo tabular" disabled={!x.trabalha} value={x[k] as string} onChange={(e) => mudaDia(d, { [k]: e.target.value } as Partial<Dia>)} />
                  </div>
                ))}
                <button type="button" className="btn btn-quieto btn-pequeno" disabled={!x.trabalha} onClick={() => copiarParaTodos(d)}>
                  Copiar para os outros dias
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Serviços que ela faz</h2>
        {categorias.map((cat) => (
          <fieldset key={cat}>
            <legend className="rotulo">{cat}</legend>
            <div className="flex flex-wrap gap-2">
              {servicos
                .filter((s) => s.categoria === cat)
                .map((s) => {
                  const m = fazem.includes(s.id);
                  return (
                    <label key={s.id} className={`cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition ${m ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white"}`}>
                      <input type="checkbox" className="sr-only" checked={m} onChange={(e) => setFazem((l) => (e.target.checked ? [...l, s.id] : l.filter((i) => i !== s.id)))} />
                      {s.nome}
                    </label>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </section>

      {erro ? <p role="alert" className="rounded-xl bg-[#fbe3e1] px-4 py-3 text-sm font-medium text-[#8c1d17]">{erro}</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-6">
        <button type="submit" className="btn btn-principal" disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</button>
        <button type="button" className="btn btn-quieto" onClick={() => router.push("/painel/profissionais")}>Cancelar</button>
        {prof ? (
          <div className="ml-auto">
            {confirma ? (
              <span className="flex items-center gap-2 text-sm">
                Excluir de vez?
                <button type="button" className="btn btn-perigo btn-pequeno" onClick={excluir} disabled={pendente}>Sim, excluir</button>
                <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => setConfirma(false)}>Não</button>
              </span>
            ) : (
              <button type="button" className="btn btn-quieto btn-pequeno text-erro" onClick={() => setConfirma(true)}>Excluir profissional</button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
