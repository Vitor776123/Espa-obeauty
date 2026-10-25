"use client";

import { useState, useTransition } from "react";
import type { Config } from "@/lib/tipos";
import { formatTelefone } from "@/lib/tempo";
import { salvarConfiguracoes } from "@/app/painel/configuracoes/actions";

export function FormularioConfig({ cfg }: { cfg: Config }) {
  const [v, setV] = useState({
    nome_salao: cfg.nome_salao,
    responsavel: cfg.responsavel,
    whatsapp: cfg.whatsapp ? formatTelefone(cfg.whatsapp) : "",
    instagram: cfg.instagram ?? "",
    endereco: cfg.endereco ?? "",
    chave_pix: cfg.chave_pix ?? "",
    pix_favorecido: cfg.pix_favorecido ?? "",
    sinal_percentual: String(cfg.sinal_percentual),
    hold_minutos: String(cfg.hold_minutos),
    slot_min: String(cfg.slot_min),
    antecedencia_min_horas: String(cfg.antecedencia_min_horas),
    limite_cancelamento_horas: String(cfg.limite_cancelamento_horas),
    janela_dias: String(cfg.janela_dias),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof typeof v, valor: string) => {
    setSalvo(false);
    setV((x) => ({ ...x, [k]: valor }));
  };
  const num = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value.replace(/[^\d.,]/g, ""));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      const r = await salvarConfiguracoes({
        nome_salao: v.nome_salao,
        responsavel: v.responsavel,
        whatsapp: v.whatsapp,
        instagram: v.instagram,
        endereco: v.endereco,
        chave_pix: v.chave_pix,
        pix_favorecido: v.pix_favorecido,
        sinal_percentual: Number(v.sinal_percentual.replace(",", ".")),
        hold_minutos: Number(v.hold_minutos),
        slot_min: Number(v.slot_min) as 5,
        antecedencia_min_horas: Number(v.antecedencia_min_horas),
        limite_cancelamento_horas: Number(v.limite_cancelamento_horas),
        janela_dias: Number(v.janela_dias),
      });
      if (!r.ok) setErro(r.erro);
      else setSalvo(true);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl">O salão</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-nome" className="rotulo">Nome do salão</label>
            <input id="c-nome" className="campo" value={v.nome_salao} onChange={(e) => set("nome_salao", e.target.value)} required />
          </div>
          <div>
            <label htmlFor="c-resp" className="rotulo">Responsável</label>
            <input id="c-resp" className="campo" value={v.responsavel} onChange={(e) => set("responsavel", e.target.value)} required />
          </div>
          <div>
            <label htmlFor="c-zap" className="rotulo">WhatsApp</label>
            <input id="c-zap" className="campo tabular" inputMode="tel" value={v.whatsapp} onChange={(e) => set("whatsapp", formatTelefone(e.target.value))} placeholder="(11) 90000-0000" />
          </div>
          <div>
            <label htmlFor="c-insta" className="rotulo">Instagram</label>
            <input id="c-insta" className="campo" value={v.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@espacobeauty" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="c-end" className="rotulo">Endereço</label>
            <input id="c-end" className="campo" value={v.endereco} onChange={(e) => set("endereco", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">PIX para o sinal</h2>
        <p className="text-sm text-suave">Aparece para a cliente quando o Mercado Pago ainda não está ligado. Nesse caso, a equipe confere o pagamento no banco e confirma no painel.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-pix" className="rotulo">Chave PIX</label>
            <input id="c-pix" className="campo" value={v.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-fav" className="rotulo">Nome do favorecido</label>
            <input id="c-fav" className="campo" value={v.pix_favorecido} onChange={(e) => set("pix_favorecido", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Regras de agendamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-sinal" className="rotulo">Sinal (% do valor)</label>
            <input id="c-sinal" className="campo tabular" inputMode="decimal" value={v.sinal_percentual} onChange={num("sinal_percentual")} />
            <p className="ajuda">Cobrado para segurar o horário quando a cliente escolhe pagar o sinal.</p>
          </div>
          <div>
            <label htmlFor="c-hold" className="rotulo">Segurar o horário por (minutos)</label>
            <input id="c-hold" className="campo tabular" inputMode="numeric" value={v.hold_minutos} onChange={num("hold_minutos")} />
            <p className="ajuda">Se o PIX não for pago nesse tempo, o horário volta a ficar livre.</p>
          </div>
          <div>
            <label htmlFor="c-slot" className="rotulo">Intervalo entre horários</label>
            <select id="c-slot" className="campo" value={v.slot_min} onChange={(e) => set("slot_min", e.target.value)}>
              {[5, 10, 15, 20, 30, 60].map((m) => (
                <option key={m} value={m}>{m} minutos</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="c-ant" className="rotulo">Antecedência mínima (horas)</label>
            <input id="c-ant" className="campo tabular" inputMode="numeric" value={v.antecedencia_min_horas} onChange={num("antecedencia_min_horas")} />
            <p className="ajuda">Para reservas feitas pelo site no mesmo dia.</p>
          </div>
          <div>
            <label htmlFor="c-lim" className="rotulo">Remarcar ou cancelar até (horas antes)</label>
            <input id="c-lim" className="campo tabular" inputMode="numeric" value={v.limite_cancelamento_horas} onChange={num("limite_cancelamento_horas")} />
            <p className="ajuda">Prazo para a cliente alterar pelo link. Depois disso, ela fala com vocês.</p>
          </div>
          <div>
            <label htmlFor="c-jan" className="rotulo">Agenda aberta por (dias)</label>
            <input id="c-jan" className="campo tabular" inputMode="numeric" value={v.janela_dias} onChange={num("janela_dias")} />
          </div>
        </div>
      </section>

      {erro ? <p role="alert" className="rounded-xl bg-[#fbe3e1] px-4 py-3 text-sm font-medium text-[#8c1d17]">{erro}</p> : null}
      {salvo ? <p role="status" className="rounded-xl bg-[#e3f2ea] px-4 py-3 text-sm font-medium text-[#1f5a3f]">Configurações salvas.</p> : null}
      <button type="submit" className="btn btn-principal" disabled={pendente}>{pendente ? "Salvando…" : "Salvar configurações"}</button>
    </form>
  );
}
