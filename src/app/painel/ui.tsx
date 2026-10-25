import type { ReactNode } from "react";
import type { StatusAgendamento, StatusPagamento } from "@/lib/tipos";
import { ROTULO_PAGAMENTO, ROTULO_STATUS } from "@/lib/tipos";

export function Titulo({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl sm:text-5xl">{titulo}</h1>
        {descricao ? <p className="mt-2 max-w-2xl text-suave">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

export function Indicador({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${destaque ? "border-ameixa bg-ameixa text-perola" : "border-linha bg-white"}`}>
      <p className={`text-sm font-medium ${destaque ? "text-cha" : "text-suave"}`}>{rotulo}</p>
      <p className="tabular mt-2 whitespace-nowrap font-display text-[1.6rem] leading-none sm:text-4xl">{valor}</p>
      {nota ? <p className={`mt-2 text-xs ${destaque ? "text-cha/80" : "text-suave"}`}>{nota}</p> : null}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-linha bg-white/60 p-10 text-center">
      <p className="font-display text-2xl">{titulo}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-suave">{children}</div> : null}
    </div>
  );
}

const CLASSE_STATUS: Record<StatusAgendamento, string> = {
  aguardando_pagamento: "selo-alerta",
  pendente: "selo-alerta",
  confirmado: "selo-ok",
  concluido: "selo",
  cancelado: "selo-neutro",
  expirado: "selo-neutro",
  faltou: "selo-erro",
};

export function SeloStatus({ status }: { status: StatusAgendamento }) {
  return <span className={`selo ${CLASSE_STATUS[status]}`}>{ROTULO_STATUS[status]}</span>;
}

export function SeloPagamento({ status }: { status: StatusPagamento }) {
  const c = status === "pago_total" ? "selo-ok" : status === "sinal_pago" ? "selo-alerta" : "selo-neutro";
  return <span className={`selo ${c}`}>{ROTULO_PAGAMENTO[status]}</span>;
}

/** Esqueleto mostrado enquanto o miolo da página do painel carrega (o menu continua no lugar). */
export function EsqueletoPainel() {
  return (
    <div className="mx-auto max-w-4xl" aria-busy="true">
      <div className="mb-8 h-12 w-64 animate-pulse rounded-xl bg-cha-claro" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-cha-claro" />
        ))}
      </div>
      <div className="mt-10 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-cha-claro/70" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
