"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "@/app/entrar/actions";

export function FormLogin() {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <form action={acao} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="username" className="campo" required autoFocus />
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" className="campo" required />
      </div>
      {estado.erro ? (
        <p role="alert" className="rounded-xl bg-[#fbe3e1] p-3 text-sm font-medium text-[#8c1d17]">
          {estado.erro}
        </p>
      ) : null}
      <button type="submit" className="btn btn-principal w-full" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
