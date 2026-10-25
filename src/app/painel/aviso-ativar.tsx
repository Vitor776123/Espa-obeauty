"use client";

import { useEffect, useState } from "react";
import { estadoNotificacao, inscreverEquipe } from "@/app/painel/configuracoes/notificacoes-cliente";

/** Faixa de topo que só aparece enquanto este aparelho ainda não recebe os avisos de reserva. */
export function AvisoAtivar({ chavePublica }: { chavePublica: string | null }) {
  const [estado, setEstado] = useState<string>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    estadoNotificacao().then(setEstado);
  }, []);

  if (!chavePublica || estado === "carregando" || estado === "ligado") return null;

  async function ligar() {
    setErro(null);
    setOcupado(true);
    try {
      await inscreverEquipe(chavePublica as string);
      setEstado(await estadoNotificacao());
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(m === "permissao-negada" ? "Você tocou em “Bloquear”. Libere as notificações nas configurações do navegador e tente de novo." : "Não foi possível ativar agora. Tente de novo.");
      setEstado(await estadoNotificacao());
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-label="Avisos no celular" className="mb-8 rounded-2xl border border-ambar/60 bg-ambar/15 p-5">
      <h2 className="text-2xl">Receba um aviso a cada reserva</h2>
      {estado === "nao-suportado" ? (
        <p className="mt-2 text-sm">
          Para receber os avisos no iPhone, toque em Compartilhar, depois em “Adicionar à Tela de Início”, e abra o site por esse ícone. Aí volte aqui e ative.
        </p>
      ) : estado === "bloqueado" ? (
        <p className="mt-2 text-sm">As notificações estão bloqueadas neste navegador. Libere nas configurações do site e volte aqui.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">O celular toca quando uma cliente reservar ou avisar que pagou, mesmo sem ela mandar mensagem.</p>
          <button type="button" className="btn btn-escuro mt-4 w-full sm:w-auto" onClick={ligar} disabled={ocupado}>
            {ocupado ? "Ativando…" : "Ativar avisos neste celular"}
          </button>
        </>
      )}
      {erro ? (
        <p role="alert" className="mt-3 text-sm font-medium text-erro">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
