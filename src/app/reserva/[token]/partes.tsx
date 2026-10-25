"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeletorHorario } from "@/components/seletor-horario";
import { IconeZap } from "@/components/icones";
import { inscrever, inscricaoAtual, pushSuportado } from "@/lib/push-cliente";
import { dataPorExtenso, formatBRL } from "@/lib/tempo";
import {
  avisarPagamentoManual,
  cancelarReserva,
  diasParaRemarcar,
  horasParaRemarcar,
  remarcarReserva,
  statusDaReserva,
} from "@/app/reserva/[token]/actions";

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-escuro btn-pequeno"
      onClick={async () => {
        setOk(await copiar(texto));
        setTimeout(() => setOk(false), 2500);
      }}
    >
      {ok ? "Copiado" : rotulo}
    </button>
  );
}

function useContagem(expiraEm: string | null) {
  const [seg, setSeg] = useState<number | null>(null);
  useEffect(() => {
    if (!expiraEm) return;
    const alvo = new Date(expiraEm).getTime();
    const tick = () => setSeg(Math.max(0, Math.floor((alvo - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiraEm]);
  return seg;
}

function Relogio({ seg }: { seg: number | null }) {
  if (seg === null) return null;
  const mm = String(Math.floor(seg / 60)).padStart(2, "0");
  const ss = String(seg % 60).padStart(2, "0");
  return (
    <span className="tabular font-semibold" role="timer" aria-live="off">
      {mm}:{ss}
    </span>
  );
}

/* ---------------- PIX automático (Mercado Pago) ---------------- */

export function PixAutomatico({
  token,
  copiaECola,
  qrBase64,
  valor,
  expiraEm,
}: {
  token: string;
  copiaECola: string;
  qrBase64: string;
  valor: number;
  expiraEm: string;
}) {
  const router = useRouter();
  const seg = useContagem(expiraEm);

  useEffect(() => {
    let vivo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      const s = await statusDaReserva(token).catch(() => null);
      if (vivo && s && s.status !== "aguardando_pagamento") router.refresh();
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [token, router]);

  return (
    <div className="cartao p-6 sm:p-8">
      <h2 className="text-3xl">Pague {formatBRL(valor)} por PIX</h2>
      <p className="mt-2 text-suave">
        Abra o app do seu banco, escolha PIX e leia o código ou cole o texto. A confirmação aparece aqui sozinha.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        {qrBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${qrBase64}`}
            alt="QR Code do PIX"
            width={208}
            height={208}
            className="mx-auto h-52 w-52 rounded-2xl border border-linha bg-white p-2"
          />
        ) : null}
        <div className="min-w-0">
          <label className="rotulo" htmlFor="pix-codigo">
            PIX copia e cola
          </label>
          <textarea id="pix-codigo" readOnly rows={4} className="campo tabular break-all text-xs" value={copiaECola} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BotaoCopiar texto={copiaECola} rotulo="Copiar código" />
            <span className="text-sm text-suave">
              O horário fica reservado por <Relogio seg={seg} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PIX manual ---------------- */

/** Botão verde que leva a cliente ao WhatsApp da Eliana com a mensagem do comprovante já escrita. */
export function ComprovanteWhatsApp({ link }: { link: string | null }) {
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="btn w-full justify-center gap-2.5 bg-ok text-white shadow-suave hover:brightness-110 sm:w-auto"
    >
      <IconeZap className="h-5 w-5" />
      Enviar comprovante no WhatsApp
    </a>
  );
}

export function PixManual({
  token,
  chave,
  favorecido,
  valor,
  zapLink,
  expiraEm,
}: {
  token: string;
  chave: string | null;
  favorecido: string | null;
  valor: number;
  zapLink: string | null;
  expiraEm: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const seg = useContagem(expiraEm);

  return (
    <div className="cartao p-6 sm:p-8">
      <h2 className="text-3xl">Faça o PIX de {formatBRL(valor)}</h2>
      {chave ? (
        <>
          <p className="mt-2 text-suave">
            Pague pelo app do seu banco, envie o comprovante no WhatsApp e toque em “Já paguei”. A Eliana confere e confirma o horário.
          </p>
          <div className="mt-6 rounded-2xl bg-cha-claro p-5">
            <p className="text-sm text-suave">Chave PIX{favorecido ? ` · ${favorecido}` : ""}</p>
            <p className="mt-1 break-all font-semibold">{chave}</p>
            <div className="mt-3">
              <BotaoCopiar texto={chave} rotulo="Copiar chave" />
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-suave">Fale com a gente pelo WhatsApp para combinar o pagamento deste horário.</p>
      )}
      {expiraEm ? (
        <p className="mt-4 text-sm text-suave">
          Seu horário fica reservado por <Relogio seg={seg} /> sem o aviso de pagamento.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="mt-4 text-sm font-medium text-erro">
          {erro}
        </p>
      ) : null}
      {zapLink ? (
        <div className="mt-6 rounded-2xl border border-ok/30 bg-ok/10 p-5">
          <p className="font-semibold">Para finalizar o seu agendamento, envie o comprovante do PIX no WhatsApp.</p>
          <p className="mt-1 text-sm text-suave">O botão abre a conversa com a Eliana já com a mensagem pronta. É só anexar o comprovante e enviar.</p>
          <div className="mt-4">
            <ComprovanteWhatsApp link={zapLink} />
          </div>
        </div>
      ) : null}
      {chave ? (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-principal w-full sm:w-auto"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await avisarPagamentoManual(token);
                if (r.ok) router.refresh();
                else setErro(r.erro ?? "Não foi possível registrar.");
              })
            }
          >
            {pendente ? "Enviando…" : "Já paguei"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Lembrete no aparelho ---------------- */

export function AvisoLembrete({ token, chavePublica }: { token: string; chavePublica: string }) {
  const [estado, setEstado] = useState<"carregando" | "indisponivel" | "pronto" | "ativo" | "negado" | "erro">("carregando");

  useEffect(() => {
    if (!pushSuportado() || !chavePublica) {
      setEstado("indisponivel");
      return;
    }
    inscricaoAtual().then((s) => setEstado(s ? "ativo" : Notification.permission === "denied" ? "negado" : "pronto"));
  }, [chavePublica]);

  async function ativar() {
    try {
      const sub = await inscrever(chavePublica);
      const r = await fetch("/api/push/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscription: sub.toJSON() }),
      });
      setEstado(r.ok ? "ativo" : "erro");
    } catch (e) {
      setEstado((e as Error).message === "permissao-negada" ? "negado" : "erro");
    }
  }

  if (estado === "carregando") return null;
  return (
    <div className="rounded-2xl border border-linha bg-white p-5">
      <h3 className="text-xl">Lembrete no seu celular</h3>
      {estado === "ativo" ? (
        <p className="mt-1 text-sm text-ok">Pronto: no dia anterior o site avisa você neste aparelho.</p>
      ) : estado === "indisponivel" ? (
        <p className="mt-1 text-sm text-suave">
          Este navegador não recebe avisos do site. No iPhone, abra o link no Safari e use “Adicionar à Tela de Início”. Enquanto isso, salve o horário na agenda.
        </p>
      ) : estado === "negado" ? (
        <p className="mt-1 text-sm text-suave">As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber o lembrete.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-suave">Receba um aviso um dia antes do seu horário.</p>
          <button type="button" className="btn btn-escuro btn-pequeno mt-3" onClick={ativar}>
            Ativar lembrete
          </button>
          {estado === "erro" ? <p className="mt-2 text-sm text-erro">Não deu certo. Tente de novo.</p> : null}
        </>
      )}
    </div>
  );
}

/* ---------------- Remarcar e cancelar ---------------- */

export function AcoesCliente({
  token,
  hoje,
  maxData,
  pode,
  motivo,
  temSinal,
  zapLink,
}: {
  token: string;
  hoje: string;
  maxData: string;
  pode: boolean;
  motivo: string | null;
  temSinal: boolean;
  zapLink: string | null;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"fechado" | "remarcar" | "cancelar">("fechado");
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const buscarDias = useCallback(
    ({ ano, mes }: { ano: number; mes: number; profissionalId: string | null }) => diasParaRemarcar({ token, ano, mes }),
    [token],
  );
  const buscarHoras = useCallback(({ data }: { data: string; profissionalId: string | null }) => horasParaRemarcar({ token, data }), [token]);

  if (!pode) {
    return (
      <div className="rounded-2xl border border-linha bg-white p-5 text-sm">
        <p className="text-suave">{motivo}</p>
        {zapLink ? (
          <a href={zapLink} target="_blank" rel="noreferrer" className="btn btn-contorno btn-pequeno mt-3">
            Falar no WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-linha bg-white p-5">
      {modo === "fechado" ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-contorno btn-pequeno" onClick={() => setModo("remarcar")}>
            Remarcar
          </button>
          <button type="button" className="btn btn-perigo btn-pequeno" onClick={() => setModo("cancelar")}>
            Cancelar reserva
          </button>
        </div>
      ) : null}

      {modo === "remarcar" ? (
        <div>
          <h3 className="text-2xl">Escolha o novo horário</h3>
          {temSinal ? <p className="mt-1 text-sm text-suave">Seu pagamento continua valendo.</p> : null}
          <div className="mt-6">
            <SeletorHorario
              hoje={hoje}
              maxData={maxData}
              profissionalId={null}
              data={data}
              hora={hora}
              onChange={(v) => {
                setData(v.data);
                setHora(v.hora);
              }}
              buscarDias={buscarDias}
              buscarHoras={buscarHoras}
              chave={token}
            />
          </div>
          {erro ? (
            <p role="alert" className="mt-4 text-sm font-medium text-erro">
              {erro}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-principal"
              disabled={!data || !hora || pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await remarcarReserva(token, data!, hora!);
                  if (r.ok) {
                    setModo("fechado");
                    router.refresh();
                  } else setErro(r.erro ?? "Não foi possível remarcar.");
                })
              }
            >
              {pendente ? "Remarcando…" : data && hora ? `Remarcar para ${dataPorExtenso(data).split(",")[1]?.trim()} às ${hora}` : "Remarcar"}
            </button>
            <button type="button" className="btn btn-quieto" onClick={() => setModo("fechado")}>
              Voltar
            </button>
          </div>
        </div>
      ) : null}

      {modo === "cancelar" ? (
        <div>
          <h3 className="text-2xl">Cancelar esta reserva?</h3>
          <p className="mt-2 text-sm text-suave">
            {temSinal ? "O sinal não é devolvido em cancelamentos. Se preferir, remarque e o pagamento continua valendo." : "O horário volta para a agenda."}
          </p>
          {erro ? (
            <p role="alert" className="mt-3 text-sm font-medium text-erro">
              {erro}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-perigo"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await cancelarReserva(token);
                  if (r.ok) router.refresh();
                  else setErro(r.erro ?? "Não foi possível cancelar.");
                })
              }
            >
              {pendente ? "Cancelando…" : "Sim, cancelar"}
            </button>
            <button type="button" className="btn btn-quieto" onClick={() => setModo("fechado")}>
              Manter reserva
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
