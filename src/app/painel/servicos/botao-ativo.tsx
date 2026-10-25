"use client";

import { useState, useTransition } from "react";
import { alternarServico } from "@/app/painel/servicos/actions";

export function BotaoAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? "Ativo no site. Clique para desativar" : "Desativado. Clique para ativar"}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await alternarServico(id, !ativo);
            if (!r.ok) setErro(r.erro);
          })
        }
        className={`relative h-7 w-12 rounded-full transition ${ativo ? "bg-ok" : "bg-linha"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${ativo ? "left-[1.4rem]" : "left-0.5"}`} />
      </button>
      {erro ? <p role="alert" className="text-xs text-erro">{erro}</p> : null}
    </div>
  );
}
