"use client";

import { useState, useTransition } from "react";
import { criarAcessoEquipe, redefinirSenhaEquipe, removerAcessoEquipe } from "@/app/painel/configuracoes/actions";

export type MembroLista = { userId: string; nome: string; email: string; papel: "admin" | "profissional"; profissional: string | null; eu: boolean };

export function Equipe({ membros, profissionais }: { membros: MembroLista[]; profissionais: { id: string; nome: string }[] }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"admin" | "profissional">("profissional");
  const [profId, setProfId] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [pendente, iniciar] = useTransition();

  function criar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await criarAcessoEquipe({ nome, email, senha, papel, profissionalId: papel === "profissional" ? profId || null : null });
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: r.aviso ?? "Acesso criado. Passe o e-mail e a senha para a pessoa." });
      setNome("");
      setEmail("");
      setSenha("");
    });
  }

  function remover(id: string) {
    setMsg(null);
    iniciar(async () => {
      const r = await removerAcessoEquipe(id);
      setMsg(r.ok ? { tipo: "ok", texto: "Acesso removido." } : { tipo: "erro", texto: r.erro });
    });
  }

  function trocar(id: string) {
    setMsg(null);
    iniciar(async () => {
      const r = await redefinirSenhaEquipe(id, novaSenha);
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: r.aviso ?? "Senha trocada." });
      setTrocando(null);
      setNovaSenha("");
    });
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2.5">
        {membros.map((m) => (
          <li key={m.userId} className="rounded-2xl border border-linha bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.nome} {m.eu ? <span className="selo ml-1">Você</span> : null}
                </p>
                <p className="truncate text-sm text-suave">
                  {m.email} · {m.papel === "admin" ? "Administradora" : `Profissional${m.profissional ? ` (${m.profissional})` : ""}`}
                </p>
              </div>
              <button type="button" className="btn btn-quieto btn-pequeno" onClick={() => { setTrocando(trocando === m.userId ? null : m.userId); setNovaSenha(""); }}>
                Trocar senha
              </button>
              {!m.eu ? (
                <button type="button" className="btn btn-quieto btn-pequeno text-erro" onClick={() => remover(m.userId)} disabled={pendente}>
                  Remover acesso
                </button>
              ) : null}
            </div>
            {trocando === m.userId ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`ns-${m.userId}`} className="rotulo">Nova senha (mínimo 8 caracteres)</label>
                  <input id={`ns-${m.userId}`} type="password" autoComplete="new-password" className="campo" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                </div>
                <button type="button" className="btn btn-escuro btn-pequeno" onClick={() => trocar(m.userId)} disabled={pendente}>Salvar senha</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <form onSubmit={criar} className="cartao space-y-4 p-6">
        <h3 className="text-2xl">Dar acesso ao painel</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="e-nome" className="rotulo">Nome</label>
            <input id="e-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="e-email" className="rotulo">E-mail de login</label>
            <input id="e-email" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </div>
          <div>
            <label htmlFor="e-senha" className="rotulo">Senha inicial</label>
            <input id="e-senha" type="password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            <p className="ajuda">Mínimo 8 caracteres. Se o e-mail já tem conta, deixe em branco: ela será liberada com a senha que já tem.</p>
          </div>
          <div>
            <label htmlFor="e-papel" className="rotulo">Tipo de acesso</label>
            <select id="e-papel" className="campo" value={papel} onChange={(e) => setPapel(e.target.value as "admin" | "profissional")}>
              <option value="profissional">Profissional (vê só a própria agenda)</option>
              <option value="admin">Administradora (vê e edita tudo)</option>
            </select>
          </div>
          {papel === "profissional" ? (
            <div className="sm:col-span-2">
              <label htmlFor="e-prof" className="rotulo">Qual profissional</label>
              <select id="e-prof" className="campo" value={profId} onChange={(e) => setProfId(e.target.value)} required>
                <option value="">Escolha…</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <button type="submit" className="btn btn-principal" disabled={pendente}>{pendente ? "Salvando…" : "Criar acesso"}</button>
      </form>

      {msg ? (
        <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.tipo === "erro" ? "bg-[#fbe3e1] text-[#8c1d17]" : "bg-[#e3f2ea] text-[#1f5a3f]"}`}>
          {msg.texto}
        </p>
      ) : null}
    </div>
  );
}
