"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SeletorHorario } from "@/components/seletor-horario";
import { dataCurta, dataPorExtenso, formatBRL, formatTelefone } from "@/lib/tempo";
import { ROTULO_TAMANHO, type AgendamentoCompleto } from "@/lib/tipos";
import {
  cancelarPelaEquipe,
  concluirAtendimento,
  confirmarAgendamento,
  diasLivresParaRemarcar,
  horasLivresParaRemarcar,
  marcarFalta,
  receberValor,
  remarcarPelaEquipe,
  salvarObservacao,
  type Resposta,
} from "@/app/painel/acoes";
import { linkWhatsappCliente } from "@/lib/whatsapp";
import { IconeZap } from "@/components/icones";
import { SeloPagamento, SeloStatus } from "@/app/painel/ui";

type Props = {
  ag: AgendamentoCompleto;
  hoje: string;
  maxData: string;
  mostrarProfissional?: boolean;
  mostrarData?: boolean;
  /** em colunas estreitas, o selo de situação desce para baixo do nome */
  compacto?: boolean;
};

function Detalhe({ ag, hoje, maxData, fechar }: { ag: AgendamentoCompleto; hoje: string; maxData: string; fechar: () => void }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"ver" | "remarcar" | "cancelar">("ver");
  const [novo, setNovo] = useState<{ data: string | null; hora: string | null }>({ data: null, hora: null });
  const [nota, setNota] = useState(ag.observacoes ?? "");
  const [valor, setValor] = useState("");

  const falta = Math.max(0, Math.round((ag.valor_total - ag.valor_pago) * 100) / 100);
  const ativo = ["aguardando_pagamento", "pendente", "confirmado"].includes(ag.status);
  const fone = formatTelefone(ag.cliente.telefone);
  const zap = linkWhatsappCliente(ag);

  const buscarDias = useCallback(
    (p: { ano: number; mes: number }) => diasLivresParaRemarcar({ id: ag.id, ano: p.ano, mes: p.mes }),
    [ag.id],
  );
  const buscarHoras = useCallback((p: { data: string }) => horasLivresParaRemarcar({ id: ag.id, data: p.data }), [ag.id]);

  function rodar(fn: () => Promise<Resposta>, aoFim?: () => void) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro);
      else (aoFim ?? fechar)();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-linha px-6 py-5">
        <div>
          <h2 className="text-3xl">{ag.cliente.nome}</h2>
          <p className="mt-1 text-suave">
            {ag.servico.nome}
            {ag.variacao ? ` · ${ROTULO_TAMANHO[ag.variacao.tamanho]}` : ""}
          </p>
        </div>
        <button type="button" className="btn btn-quieto btn-pequeno" onClick={fechar}>
          Fechar
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="flex flex-wrap gap-2">
          <SeloStatus status={ag.status} />
          <SeloPagamento status={ag.pagamento_status} />
        </div>

        <a href={zap} target="_blank" rel="noreferrer" className="btn w-full justify-center gap-2.5 bg-ok text-white shadow-suave hover:brightness-110 sm:w-auto">
          <IconeZap className="h-5 w-5" />
          Chamar {ag.cliente.nome.split(" ")[0]} no WhatsApp
        </a>

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-suave">Quando</dt>
            <dd className="first-letter:uppercase">
              {dataPorExtenso(ag.data)}, {ag.inicio} às {ag.fim}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-suave">Profissional</dt>
            <dd>{ag.profissional.nome}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-suave">Valor</dt>
            <dd className="tabular">
              {formatBRL(ag.valor_total)} · pago {formatBRL(ag.valor_pago)}
              {falta > 0 ? ` · falta ${formatBRL(falta)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-suave">Contato</dt>
            <dd className="tabular">
              <a className="font-semibold text-framboesa underline underline-offset-4" href={zap} target="_blank" rel="noreferrer">
                {fone}
              </a>
              {ag.cliente.email ? <span className="block text-sm text-suave">{ag.cliente.email}</span> : null}
            </dd>
          </div>
        </dl>

        {modo === "ver" ? (
          <div className="space-y-5">
            <div>
              <label htmlFor={`obs-${ag.id}`} className="rotulo">
                Observações
              </label>
              <textarea id={`obs-${ag.id}`} className="campo" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={600} />
              {nota.trim() !== (ag.observacoes ?? "") ? (
                <button
                  type="button"
                  className="btn btn-contorno btn-pequeno mt-2"
                  disabled={pendente}
                  onClick={() => rodar(() => salvarObservacao(ag.id, nota), () => {})}
                >
                  Salvar observação
                </button>
              ) : null}
            </div>

            {ativo ? (
              <div className="flex flex-wrap gap-2">
                {ag.status !== "confirmado" ? (
                  <button type="button" className="btn btn-principal" disabled={pendente} onClick={() => rodar(() => confirmarAgendamento(ag.id))}>
                    Confirmar pagamento
                  </button>
                ) : null}
                {ag.status === "confirmado" && falta > 0 ? (
                  <button type="button" className="btn btn-escuro" disabled={pendente} onClick={() => rodar(() => receberValor(ag.id, falta))}>
                    Receber {formatBRL(falta)}
                  </button>
                ) : null}
                <button type="button" className="btn btn-contorno" disabled={pendente} onClick={() => rodar(() => concluirAtendimento(ag.id, true))}>
                  {falta > 0 ? "Concluir e receber o restante" : "Concluir atendimento"}
                </button>
                <button type="button" className="btn btn-quieto" disabled={pendente} onClick={() => setModo("remarcar")}>
                  Remarcar
                </button>
                <button type="button" className="btn btn-quieto" disabled={pendente} onClick={() => rodar(() => marcarFalta(ag.id))}>
                  Não compareceu
                </button>
                <button type="button" className="btn btn-perigo" disabled={pendente} onClick={() => setModo("cancelar")}>
                  Cancelar
                </button>
              </div>
            ) : null}

            {ativo && ag.status === "confirmado" ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(valor.replace(",", "."));
                  if (!n || n <= 0) return setErro("Informe um valor maior que zero.");
                  rodar(() => receberValor(ag.id, n), () => setValor(""));
                }}
              >
                <div>
                  <label htmlFor={`val-${ag.id}`} className="rotulo">
                    Registrar outro valor recebido
                  </label>
                  <input id={`val-${ag.id}`} className="campo w-40" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-contorno btn-pequeno" disabled={pendente}>
                  Registrar
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {modo === "remarcar" ? (
          <div className="space-y-4">
            <h3 className="text-2xl">Novo horário</h3>
            <SeletorHorario
              hoje={hoje}
              maxData={maxData}
              profissionalId={ag.profissional_id}
              data={novo.data}
              hora={novo.hora}
              onChange={setNovo}
              buscarDias={buscarDias}
              buscarHoras={buscarHoras}
              chave={ag.id}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-principal"
                disabled={pendente || !novo.data || !novo.hora}
                onClick={() => rodar(() => remarcarPelaEquipe(ag.id, novo.data!, novo.hora!))}
              >
                {novo.data && novo.hora ? `Mover para ${dataCurta(novo.data)} às ${novo.hora}` : "Escolha dia e horário"}
              </button>
              <button type="button" className="btn btn-quieto" onClick={() => setModo("ver")}>
                Voltar
              </button>
            </div>
          </div>
        ) : null}

        {modo === "cancelar" ? (
          <div className="space-y-4 rounded-2xl border border-erro/30 bg-[#fdf1f0] p-5">
            <p className="font-semibold">Cancelar este agendamento?</p>
            <p className="text-sm text-suave">O horário volta a ficar livre e a cliente é avisada, se tiver ativado as notificações.</p>
            <div className="flex flex-wrap gap-2">
              {ag.valor_pago > 0 ? (
                <>
                  <button type="button" className="btn btn-perigo" disabled={pendente} onClick={() => rodar(() => cancelarPelaEquipe(ag.id, true))}>
                    Cancelar e marcar como reembolsado
                  </button>
                  <button type="button" className="btn btn-perigo" disabled={pendente} onClick={() => rodar(() => cancelarPelaEquipe(ag.id, false))}>
                    Cancelar e manter o valor pago
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-perigo" disabled={pendente} onClick={() => rodar(() => cancelarPelaEquipe(ag.id, false))}>
                  Sim, cancelar
                </button>
              )}
              <button type="button" className="btn btn-quieto" onClick={() => setModo("ver")}>
                Voltar
              </button>
            </div>
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="text-sm font-medium text-erro">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CartaoAgendamento({ ag, hoje, maxData, mostrarProfissional, mostrarData, compacto }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const inativo = ["cancelado", "expirado", "faltou"].includes(ag.status);
  const falta = Math.max(0, ag.valor_total - ag.valor_pago);

  return (
    <>
      <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`group flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-linha bg-white p-4 text-left transition hover:border-framboesa hover:shadow-suave ${inativo ? "opacity-60" : ""}`}
      >
        <span
          className="tabular shrink-0 font-display text-2xl leading-none"
          style={{ borderLeft: `4px solid ${ag.profissional.cor}`, paddingLeft: "0.6rem" }}
        >
          {ag.inicio}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{ag.cliente.nome}</span>
          <span className="block truncate text-sm text-suave">
            {ag.servico.nome}
            {ag.variacao ? ` · ${ROTULO_TAMANHO[ag.variacao.tamanho].replace("Cabelo ", "")}` : ""}
            {mostrarProfissional ? ` · ${ag.profissional.nome}` : ""}
            {mostrarData ? ` · ${dataCurta(ag.data)}` : ""}
          </span>
          <span className={`mt-1.5 flex-wrap items-center gap-2 ${compacto ? "flex" : "flex sm:hidden"}`}>
            <SeloStatus status={ag.status} />
            {!inativo && falta > 0 ? <span className="tabular text-xs text-suave">falta {formatBRL(falta)}</span> : null}
          </span>
        </span>
        {!compacto ? (
          <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <SeloStatus status={ag.status} />
            {!inativo && falta > 0 ? <span className="tabular text-xs text-suave">falta {formatBRL(falta)}</span> : null}
          </span>
        ) : null}
      </button>
      {!inativo ? (
        <a
          href={linkWhatsappCliente(ag)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Chamar ${ag.cliente.nome} no WhatsApp`}
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-ok text-white shadow-suave"
        >
          <IconeZap className="h-6 w-6" />
        </a>
      ) : null}
      </div>

      <dialog ref={ref} className="gaveta" onClose={() => setAberto(false)} onClick={(e) => e.target === ref.current && setAberto(false)}>
        {aberto ? <Detalhe ag={ag} hoje={hoje} maxData={maxData} fechar={() => setAberto(false)} /> : null}
      </dialog>
    </>
  );
}
