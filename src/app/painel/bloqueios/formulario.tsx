"use client";

import { useState, useTransition } from "react";
import { dataCurta } from "@/lib/tempo";
import { criarBloqueio, removerBloqueio } from "@/app/painel/bloqueios/actions";

export function FormularioBloqueio({
  hoje,
  profissionais,
  admin,
}: {
  hoje: string;
  profissionais: { id: string; nome: string }[];
  admin: boolean;
}) {
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [diaTodo, setDiaTodo] = useState(false);
  const [inicio, setInicio] = useState("12:00");
  const [fim, setFim] = useState("14:00");
  const [prof, setProf] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await criarBloqueio({
        profissionalId: admin ? prof || null : null,
        de,
        ate: ate < de ? de : ate,
        inicio: diaTodo ? "00:00" : inicio,
        fim: diaTodo ? "23:59" : fim,
        motivo: motivo || null,
      });
      if (!r.ok) return setErro(r.erro);
      setMotivo("");
      setAviso(
        r.conflitos.length
          ? `Bloqueio criado. Atenção: ${r.conflitos.length} agendamento(s) já estavam nesse período: ${r.conflitos
              .slice(0, 5)
              .map((c) => `${c.cliente} (${dataCurta(c.data)} ${c.inicio})`)
              .join(", ")}. Remarque ou cancele na Agenda.`
          : "Bloqueio criado. Esses horários não aparecem mais no site.",
      );
    });
  }

  return (
    <form onSubmit={enviar} className="cartao space-y-4 p-6">
      <h2 className="text-2xl">Bloquear horários</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="b-de" className="rotulo">De</label>
          <input id="b-de" type="date" className="campo" min={hoje} value={de} onChange={(e) => { setDe(e.target.value); if (ate < e.target.value) setAte(e.target.value); }} required />
        </div>
        <div>
          <label htmlFor="b-ate" className="rotulo">Até (para vários dias)</label>
          <input id="b-ate" type="date" className="campo" min={de} value={ate} onChange={(e) => setAte(e.target.value)} required />
        </div>
      </div>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-[#a8325a]" checked={diaTodo} onChange={(e) => setDiaTodo(e.target.checked)} />
        Dia inteiro
      </label>
      {!diaTodo ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="b-ini" className="rotulo">Das</label>
            <input id="b-ini" type="time" className="campo tabular" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="b-fim" className="rotulo">Até as</label>
            <input id="b-fim" type="time" className="campo tabular" value={fim} onChange={(e) => setFim(e.target.value)} required />
          </div>
        </div>
      ) : null}
      {admin && profissionais.length > 0 ? (
        <div>
          <label htmlFor="b-prof" className="rotulo">Vale para</label>
          <select id="b-prof" className="campo" value={prof} onChange={(e) => setProf(e.target.value)}>
            <option value="">Todas as profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label htmlFor="b-motivo" className="rotulo">Motivo (opcional)</label>
        <input id="b-motivo" className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Ex.: médico, folga, curso" />
      </div>
      {erro ? <p role="alert" className="text-sm font-medium text-erro">{erro}</p> : null}
      {aviso ? <p role="status" className="rounded-xl bg-cha-claro px-4 py-3 text-sm">{aviso}</p> : null}
      <button type="submit" className="btn btn-principal" disabled={pendente}>{pendente ? "Salvando…" : "Bloquear"}</button>
    </form>
  );
}

export function BotaoRemover({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="text-right">
      <button
        type="button"
        className="btn btn-quieto btn-pequeno text-erro"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await removerBloqueio(id);
            if (!r.ok) setErro(r.erro ?? "Erro.");
          })
        }
      >
        {pendente ? "Removendo…" : "Remover"}
      </button>
      {erro ? <span role="alert" className="block text-xs text-erro">{erro}</span> : null}
    </span>
  );
}
