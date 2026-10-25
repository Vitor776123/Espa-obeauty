"use client";

import { useEffect, useState } from "react";
import { inscreverEquipe, desinscreverEquipe, estadoNotificacao, type EstadoNotificacao } from "@/app/painel/configuracoes/notificacoes-cliente";

export function NotificacoesAparelho({ chavePublica }: { chavePublica: string | null }) {
  const [estado, setEstado] = useState<EstadoNotificacao | "carregando">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    estadoNotificacao().then(setEstado);
  }, []);

  async function ligar() {
    setErro(null);
    setOcupado(true);
    try {
      if (!chavePublica) throw new Error("As notificações ainda não foram configuradas no servidor (chaves VAPID).");
      await inscreverEquipe(chavePublica);
      setEstado(await estadoNotificacao());
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(m === "permissao-negada" ? "A permissão foi negada. Libere as notificações nas configurações do navegador e tente de novo." : m || "Não foi possível ligar as notificações.");
      setEstado(await estadoNotificacao());
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    setErro(null);
    try {
      await desinscreverEquipe();
      setEstado(await estadoNotificacao());
    } catch {
      setErro("Não foi possível desligar agora.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">
        Receba um aviso neste aparelho quando alguém agendar ou pagar, e um resumo do dia de manhã. No iPhone, primeiro adicione o site à Tela de Início (Compartilhar, depois “Adicionar à Tela de Início”) e abra por lá.
      </p>
      {estado === "carregando" ? <p className="text-sm text-suave">Verificando…</p> : null}
      {estado === "nao-suportado" ? <p className="text-sm font-medium text-alerta">Este navegador não aceita notificações. No iPhone, abra pelo ícone na Tela de Início.</p> : null}
      {estado === "bloqueado" ? <p className="text-sm font-medium text-alerta">As notificações estão bloqueadas neste navegador. Libere nas configurações do site e volte aqui.</p> : null}
      {estado === "ligado" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="selo selo-ok">Ligadas neste aparelho</span>
          <button type="button" className="btn btn-contorno btn-pequeno" onClick={desligar} disabled={ocupado}>Desligar</button>
        </div>
      ) : null}
      {estado === "desligado" ? (
        <button type="button" className="btn btn-escuro" onClick={ligar} disabled={ocupado}>{ocupado ? "Ligando…" : "Ligar notificações neste aparelho"}</button>
      ) : null}
      {erro ? <p role="alert" className="text-sm font-medium text-erro">{erro}</p> : null}
    </div>
  );
}
