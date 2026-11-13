"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buscarDiasLivres, buscarHorasLivres, criarReservaPublica } from "@/app/agendar/actions";
import {
  agruparHoras,
  atrasoDigitando,
  emailValido,
  emojiCategoria,
  emojiServico,
  nomeValido,
  primeiroNome,
  rotuloDia,
  telefoneValido,
} from "@/lib/chat-agendamento";
import { calcularCobranca } from "@/lib/cobranca";
import { dataPorExtenso, formatBRL, formatDuracao, formatTelefone, FUSO, soDigitos } from "@/lib/tempo";
import { ROTULO_TAMANHO, type Tamanho } from "@/lib/tipos";

export type ServicoChat = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  descricao: string;
  temTamanho: boolean;
  preco: number;
  duracao: number;
  variacoes: { id: string; tamanho: Tamanho; preco: number; duracao: number }[];
  profissionais: string[];
};

type Props = {
  servicos: ServicoChat[];
  profissionais: { id: string; nome: string }[];
  hoje: string;
  maxData: string;
  sinalPct: number;
  holdMinutos: number;
  exigeEmail: boolean;
  slugInicial: string | null;
  whatsapp: string | null;
};

/** Cada mensagem guarda a etapa que a gerou: é assim que "voltar" sabe até onde apagar a conversa. */
type Etapa =
  | "boasvindas"
  | "confirma"
  | "categoria"
  | "servico"
  | "tamanho"
  | "profissional"
  | "dia"
  | "hora"
  | "nome"
  | "telefone"
  | "email"
  | "pagamento"
  | "resumo"
  | "enviando"
  | "fim";

type Conteudo = {
  texto?: string;
  foto?: { src: string; alt: string };
  resumo?: { linhas: [string, string][] };
  link?: { rotulo: string; href: string };
};
type Msg = Conteudo & { id: number; de: "bot" | "eu"; etapa: Etapa; hora: string };

type Opcao = { id: string; rotulo: string; detalhe?: string; tom?: "principal" | "neutro"; href?: string };
type Grupo = { titulo?: string; layout: "lista" | "grade2" | "grade3"; opcoes: Opcao[] };
type Bandeja = { etapa: Etapa; grupos: Grupo[] };

type Dados = {
  categoria: string | null;
  servicoId: string | null;
  variacaoId: string | null;
  profId: string | null;
  data: string | null;
  hora: string | null;
  nome: string;
  telefone: string;
  email: string;
  tipo: "sinal" | "total" | null;
};

type ListaDias = { lista: string[]; mostrando: number; ano: number; mes: number; fim: boolean };

const TAMANHO_PAGINA_DIAS = 6;
const ORDEM_LIMPEZA: Etapa[] = ["categoria", "servico", "tamanho", "profissional", "dia", "hora"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const horaAgora = () =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }).format(new Date());
const dadosVazios = (): Dados => ({
  categoria: null,
  servicoId: null,
  variacaoId: null,
  profId: null,
  data: null,
  hora: null,
  nome: "",
  telefone: "",
  email: "",
  tipo: null,
});

function detalheServico(s: ServicoChat): string {
  return s.temTamanho
    ? `a partir de ${formatBRL(s.preco)} · varia com o cabelo`
    : `${formatBRL(s.preco)} · ${formatDuracao(s.duracao)}`;
}

/** *texto* vira negrito, como no WhatsApp. */
function comNegrito(t: string): ReactNode[] {
  return t.split(/(\*[^*]+\*)/g).map((p, i) =>
    p.length > 2 && p.startsWith("*") && p.endsWith("*") ? <strong key={i}>{p.slice(1, -1)}</strong> : p,
  );
}

/* ---------- ícones ---------- */
const traco = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...traco}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
function IconeEnviar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...traco}>
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4 18-7z" />
    </svg>
  );
}
function IconeRecomecar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...traco}>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}
function IconeVisto() {
  return (
    <svg viewBox="0 0 20 12" className="h-3 w-4 text-ambar" aria-label="Enviada" role="img" {...traco} strokeWidth={1.8}>
      <path d="M1 6.5l3.5 3.5L11 2.5" />
      <path d="M8 8.5L9.5 10 16 2.5" />
    </svg>
  );
}

/* ---------- partes visuais ---------- */
function Balao({ m }: { m: Msg }) {
  const meu = m.de === "eu";
  return (
    <div data-balao className={`balao-entra flex ${meu ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-3 pb-1.5 pt-2 text-[0.97rem] leading-snug shadow-sm ${
          meu ? "rounded-tr-md bg-framboesa text-white" : "rounded-tl-md bg-white text-ameixa"
        }`}
      >
        {m.foto ? (
          <div className="mb-1.5 overflow-hidden rounded-xl bg-blush px-4 pt-3">
            <Image src={m.foto.src} alt={m.foto.alt} width={640} height={726} sizes="11rem" className="mx-auto w-40" />
          </div>
        ) : null}
        {m.texto ? <p className="whitespace-pre-line">{comNegrito(m.texto)}</p> : null}
        {m.resumo ? (
          <dl className="mt-2 space-y-1.5 rounded-xl bg-cha-claro px-3 py-2.5 text-sm">
            {m.resumo.linhas.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-suave">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {m.link ? (
          <Link
            href={m.link.href}
            className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-framboesa/30 bg-white px-4 text-sm font-semibold text-framboesa hover:border-framboesa"
          >
            {m.link.rotulo}
          </Link>
        ) : null}
        <span className={`mt-0.5 flex items-center justify-end gap-1 text-[0.68rem] ${meu ? "text-white/80" : "text-suave"}`}>
          {m.hora}
          {meu ? <IconeVisto /> : null}
        </span>
      </div>
    </div>
  );
}

function Digitando() {
  return (
    <div className="flex justify-start" role="status">
      <span className="sr-only">A assistente está digitando</span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3.5 shadow-sm" aria-hidden>
        <span className="ponto-digitando h-2 w-2 rounded-full bg-suave/60" />
        <span className="ponto-digitando h-2 w-2 rounded-full bg-suave/60" />
        <span className="ponto-digitando h-2 w-2 rounded-full bg-suave/60" />
      </div>
    </div>
  );
}

function classeOpcao(o: Opcao, grade: boolean): string {
  const base = `flex w-full items-center rounded-2xl border-[1.5px] transition active:translate-y-px ${
    grade ? "min-h-12 justify-center px-2 text-center" : "min-h-12 px-4 py-2 text-left"
  }`;
  if (o.tom === "principal") return `${base} border-framboesa bg-framboesa font-semibold text-white shadow-suave hover:bg-framboesa-2`;
  if (o.tom === "neutro") return `${base} border-linha bg-white/70 text-[0.93rem] font-medium text-suave hover:border-ameixa/40`;
  return `${base} border-framboesa/25 bg-white font-semibold text-framboesa hover:border-framboesa`;
}

function Opcoes({ bandeja, onEscolher }: { bandeja: Bandeja; onEscolher: (o: Opcao) => void }) {
  return (
    <div className="balao-entra mt-1 space-y-3" role="group" aria-label="Opções de resposta">
      {bandeja.grupos.map((g, i) => {
        const grade = g.layout !== "lista";
        return (
          <div key={i}>
            {g.titulo ? <p className="mb-1.5 px-1 text-xs font-semibold text-suave">{g.titulo}</p> : null}
            <ul className={`grid gap-2 ${g.layout === "grade3" ? "grid-cols-3" : g.layout === "grade2" ? "grid-cols-2" : "grid-cols-1"}`}>
              {g.opcoes.map((o) => (
                <li key={o.id}>
                  {o.href ? (
                    <a href={o.href} target="_blank" rel="noopener noreferrer" className={classeOpcao(o, grade)}>
                      {o.rotulo}
                    </a>
                  ) : (
                    <button type="button" onClick={() => onEscolher(o)} className={classeOpcao(o, grade)}>
                      <span className={grade ? "tabular" : "block"}>
                        <span className="block leading-tight">{o.rotulo}</span>
                        {o.detalhe ? <span className="mt-0.5 block text-[0.8rem] font-normal text-suave">{o.detalhe}</span> : null}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- o chat ---------- */
export function ChatAgendamento(props: Props) {
  const { servicos, profissionais, hoje, maxData, sinalPct, holdMinutos, exigeEmail, whatsapp } = props;
  const router = useRouter();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [entrada, setEntrada] = useState<"nome" | "telefone" | "email" | null>(null);
  const [texto, setTexto] = useState("");
  const [encerrada, setEncerrada] = useState(false);
  const [viewport, setViewport] = useState<{ h: number; top: number } | null>(null);

  const gen = useRef(0); // sobe a cada reinício/volta: cancela falas pendentes
  const seq = useRef(0);
  const dados = useRef<Dados>(dadosVazios());
  const horasRef = useRef<string[]>([]);
  const dias = useRef<ListaDias>({ lista: [], mostrando: TAMANHO_PAGINA_DIAS, ano: 0, mes: 0, fim: false });
  const rolagem = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const bandejaRef = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const categorias = Array.from(new Set(servicos.map((s) => s.categoria)));
  const [anoMax, mesMax] = maxData.split("-").map(Number);
  const [anoHoje, mesHoje] = hoje.split("-").map(Number);

  const servicoAtual = () => servicos.find((s) => s.id === dados.current.servicoId) ?? null;
  const profsDo = (s: ServicoChat | null) => (s ? profissionais.filter((p) => s.profissionais.includes(p.id)) : []);
  const precoAtual = () => {
    const s = servicoAtual();
    const v = s?.variacoes.find((x) => x.id === dados.current.variacaoId);
    return v?.preco ?? s?.preco ?? 0;
  };
  const duracaoAtual = () => {
    const s = servicoAtual();
    const v = s?.variacoes.find((x) => x.id === dados.current.variacaoId);
    return v?.duracao ?? s?.duracao ?? 0;
  };
  const etapaDoServico = (): Etapa => "servico";

  /* ----- mensagens ----- */
  function adicionar(m: Omit<Msg, "id" | "hora">) {
    setMsgs((a) => [...a, { ...m, id: ++seq.current, hora: horaAgora() }]);
  }
  function eu(etapa: Etapa, texto: string) {
    adicionar({ de: "eu", etapa, texto });
  }
  /** Fala como a assistente: "digitando…" e depois a mensagem. Devolve false se a conversa mudou no meio. */
  async function falar(etapa: Etapa, ...itens: Conteudo[]): Promise<boolean> {
    const minha = gen.current;
    for (const item of itens) {
      setDigitando(true);
      await dormir(atrasoDigitando(item.texto ?? "", reduzMovimento()));
      if (minha !== gen.current) return false;
      setDigitando(false);
      adicionar({ de: "bot", etapa, ...item });
    }
    return true;
  }
  function mostrar(etapa: Etapa, grupos: Grupo[]) {
    setEntrada(null);
    setBandeja({ etapa, grupos });
  }
  function pedirTexto(e: "nome" | "telefone" | "email") {
    setBandeja(null);
    setTexto("");
    setEntrada(e);
  }

  /* ----- datas ----- */
  async function carregarDias(minimo: number) {
    const L = dias.current;
    const D = dados.current;
    while (!L.fim && L.lista.length < minimo) {
      const livres = await buscarDiasLivres({
        servicoId: D.servicoId!,
        variacaoId: D.variacaoId,
        profissionalId: D.profId,
        ano: L.ano,
        mes: L.mes,
      });
      if (L !== dias.current) return; // a lista foi reiniciada enquanto buscava
      L.lista.push(...livres.filter((x) => x >= hoje && x <= maxData));
      if (L.ano > anoMax || (L.ano === anoMax && L.mes >= mesMax)) L.fim = true;
      else if (L.mes === 12) {
        L.ano += 1;
        L.mes = 1;
      } else L.mes += 1;
    }
  }

  function linkWhatsapp(): string | null {
    const d = soDigitos(whatsapp ?? "");
    if (d.length < 10) return null;
    const numero = d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
    return `https://wa.me/${numero}?text=${encodeURIComponent("Olá! Queria agendar um horário no Espaço Beauty 💖")}`;
  }

  async function mostrarDias() {
    const L = dias.current;
    if (L.lista.length === 0) {
      const zap = linkWhatsapp();
      if (!(await falar("dia", { texto: "Poxa, não encontrei horários livres nos próximos dias 😕" }))) return;
      mostrar("dia", [
        {
          layout: "lista",
          opcoes: [
            ...(zap ? [{ id: "zap", rotulo: "💬 Falar com a Eliana no WhatsApp", href: zap }] : []),
            { id: "voltar", rotulo: "↩️ Voltar", tom: "neutro" as const },
          ],
        },
      ]);
      return;
    }
    const visiveis = L.lista.slice(0, L.mostrando);
    const temMais = L.mostrando < L.lista.length;
    mostrar("dia", [
      { layout: "grade2", opcoes: visiveis.map((d) => ({ id: d, rotulo: rotuloDia(d, hoje) })) },
      {
        layout: "lista",
        opcoes: [
          ...(temMais ? [{ id: "mais", rotulo: "➕ Ver mais datas", tom: "neutro" as const }] : []),
          { id: "voltar", rotulo: "↩️ Voltar", tom: "neutro" as const },
        ],
      },
    ]);
  }

  async function maisDatas() {
    const minha = gen.current;
    const L = dias.current;
    setBandeja(null);
    setDigitando(true);
    L.mostrando += TAMANHO_PAGINA_DIAS;
    try {
      await carregarDias(L.mostrando + 1);
    } catch {
      if (minha !== gen.current) return;
      setDigitando(false);
      await erroDeAgenda("dia");
      return;
    }
    if (minha !== gen.current) return;
    setDigitando(false);
    await mostrarDias();
  }

  async function erroDeAgenda(etapa: "dia" | "hora") {
    if (!(await falar(etapa, { texto: "Não consegui carregar a agenda agora 😕 Quer tentar de novo?" }))) return;
    mostrar(etapa, [
      {
        layout: "lista",
        opcoes: [
          { id: "tentar", rotulo: "🔄 Tentar de novo" },
          { id: "voltar", rotulo: "↩️ Voltar", tom: "neutro" },
        ],
      },
    ]);
  }

  /** Mostra só os horários cheios e de meia hora; "Ver todos" abre a lista completa. */
  function mostrarHoras(todas: boolean) {
    const completa = horasRef.current;
    const principais = completa.filter((h) => h.endsWith(":00") || h.endsWith(":30"));
    const lista = !todas && principais.length >= 4 && principais.length < completa.length ? principais : completa;
    const temMais = lista.length < completa.length;
    mostrar("hora", [
      ...agruparHoras(lista).map((g) => ({
        titulo: `${g.emoji} ${g.titulo}`,
        layout: "grade3" as const,
        opcoes: g.horas.map((h) => ({ id: h, rotulo: h })),
      })),
      {
        layout: "lista",
        opcoes: [
          ...(temMais ? [{ id: "todas-horas", rotulo: "🕐 Ver todos os horários", tom: "neutro" as const }] : []),
          { id: "voltar", rotulo: "📅 Escolher outro dia", tom: "neutro" as const },
        ],
      },
    ]);
  }

  /* ----- perguntas de cada etapa ----- */
  function proximaEtapaDeDados(): Etapa {
    const D = dados.current;
    if (!nomeValido(D.nome)) return "nome";
    if (!telefoneValido(D.telefone)) return "telefone";
    if (exigeEmail && !emailValido(D.email)) return "email";
    return D.tipo ? "resumo" : "pagamento";
  }

  function depoisDoTamanho() {
    return perguntar(profsDo(servicoAtual()).length > 1 ? "profissional" : "dia");
  }
  function depoisDoServico() {
    const S = servicoAtual();
    if (S?.temTamanho && !dados.current.variacaoId) return perguntar("tamanho");
    return depoisDoTamanho();
  }

  async function perguntar(etapa: Etapa): Promise<void> {
    const minha = gen.current;
    const vivo = () => minha === gen.current;
    const D = dados.current;
    const S = servicoAtual();

    switch (etapa) {
      case "categoria": {
        // sem categoria: a assistente já mostra todos os serviços de uma vez
        D.categoria = null;
        return perguntar("servico");
      }

      case "servico": {
        if (!(await falar("servico", { texto: "Qual serviço você quer agendar? 💖 Estes são todos os que a Eliana faz 👇" }))) return;
        mostrar("servico", [
          ...categorias.map((c) => ({
            titulo: `${emojiCategoria(c)} ${c}`,
            layout: "lista" as const,
            opcoes: servicos
              .filter((s) => s.categoria === c)
              .map((s) => ({
                id: s.id,
                rotulo: `${emojiServico(s.nome, s.categoria)} ${s.nome}`,
                detalhe: detalheServico(s),
              })),
          })),
          { layout: "lista" as const, opcoes: [{ id: "agora-nao", rotulo: "Agora não", tom: "neutro" as const }] },
        ]);
        return;
      }

      case "tamanho": {
        if (!S) return;
        if (!(await falar("tamanho", { texto: "Qual o comprimento do seu cabelo? 💇‍♀️ O valor e o tempo mudam com ele." }))) return;
        mostrar("tamanho", [
          {
            layout: "lista",
            opcoes: S.variacoes.map((v) => ({
              id: v.id,
              rotulo: ROTULO_TAMANHO[v.tamanho],
              detalhe: `${formatBRL(v.preco)} · ${formatDuracao(v.duracao)}`,
            })),
          },
          { layout: "lista", opcoes: [{ id: "voltar", rotulo: "↩️ Trocar de serviço", tom: "neutro" }] },
        ]);
        return;
      }

      case "profissional": {
        if (!(await falar("profissional", { texto: "Você prefere alguma profissional em especial? 💁‍♀️" }))) return;
        mostrar("profissional", [
          {
            layout: "lista",
            opcoes: [
              { id: "qualquer", rotulo: "Quem estiver livre ✨" },
              ...profsDo(S).map((p) => ({ id: p.id, rotulo: p.nome })),
            ],
          },
          { layout: "lista", opcoes: [{ id: "voltar", rotulo: "↩️ Voltar", tom: "neutro" }] },
        ]);
        return;
      }

      case "dia": {
        const emoji = S ? emojiServico(S.nome, S.categoria) : "💖";
        if (!(await falar("dia", { texto: `Show! ${emoji} Qual dia fica bom pra você? 📅` }))) return;
        dias.current = { lista: [], mostrando: TAMANHO_PAGINA_DIAS, ano: anoHoje, mes: mesHoje, fim: false };
        setDigitando(true);
        try {
          await carregarDias(TAMANHO_PAGINA_DIAS + 1);
        } catch {
          if (!vivo()) return;
          setDigitando(false);
          await erroDeAgenda("dia");
          return;
        }
        if (!vivo()) return;
        setDigitando(false);
        await mostrarDias();
        return;
      }

      case "hora": {
        const data = D.data;
        if (!data) return;
        if (!(await falar("hora", { texto: `Ótimo! 🎉 Para *${cap(dataPorExtenso(data))}* eu tenho estes horários livres 🕐` }))) return;
        setDigitando(true);
        let horas: string[];
        try {
          horas = await buscarHorasLivres({ servicoId: D.servicoId!, variacaoId: D.variacaoId, profissionalId: D.profId, data });
        } catch {
          if (!vivo()) return;
          setDigitando(false);
          await erroDeAgenda("hora");
          return;
        }
        if (!vivo()) return;
        setDigitando(false);
        if (horas.length === 0) {
          if (!(await falar("hora", { texto: "Poxa, esse dia acabou de ficar sem horários 😕 Vamos escolher outro?" }))) return;
          D.data = null;
          return perguntar("dia");
        }
        horasRef.current = horas;
        mostrarHoras(false);
        return;
      }

      case "nome": {
        if (!(await falar("nome", { texto: "Perfeito! Para finalizar, qual o seu *nome completo*? ✍️" }))) return;
        pedirTexto("nome");
        return;
      }

      case "telefone": {
        const saudacao = primeiroNome(D.nome) ? `Prazer, ${primeiroNome(D.nome)}! 💕 ` : "";
        if (!(await falar("telefone", { texto: `${saudacao}Qual o seu *telefone com DDD*? 📱 É com ele que eu identifico as suas reservas.` }))) return;
        pedirTexto("telefone");
        return;
      }

      case "email": {
        if (!(await falar("email", { texto: "E o seu *e-mail*? 📧 Ele é necessário para gerar o PIX." }))) return;
        pedirTexto("email");
        return;
      }

      case "pagamento": {
        const preco = precoAtual();
        if (preco <= 0 || !(sinalPct > 0 && sinalPct < 100)) {
          D.tipo = "total";
          return perguntar("resumo");
        }
        if (!(await falar("pagamento", { texto: "Para garantir o seu horário, como você prefere pagar? 💳" }))) return;
        mostrar("pagamento", [
          {
            layout: "lista",
            opcoes: [
              {
                id: "sinal",
                rotulo: `Sinal de ${sinalPct}% · ${formatBRL(calcularCobranca(preco, "sinal", sinalPct))}`,
                detalhe: "O restante você paga no salão. O sinal não é devolvido se cancelar.",
              },
              { id: "total", rotulo: `Valor total · ${formatBRL(preco)}`, detalhe: "Chega e é só ser atendida." },
            ],
          },
        ]);
        return;
      }

      case "resumo": {
        if (!S || !D.data || !D.hora) return;
        const preco = precoAtual();
        const cobranca = preco <= 0 ? 0 : calcularCobranca(preco, D.tipo ?? "total", sinalPct);
        const variacao = S.variacoes.find((v) => v.id === D.variacaoId);
        const profs = profsDo(S);
        const prof = profs.find((p) => p.id === D.profId);
        const linhas: [string, string][] = [
          ["Serviço", `${emojiServico(S.nome, S.categoria)} ${S.nome}${variacao ? ` (${ROTULO_TAMANHO[variacao.tamanho]})` : ""}`],
          ["Quando", `${cap(dataPorExtenso(D.data))}, ${D.hora}`],
          ["Duração", formatDuracao(duracaoAtual())],
        ];
        if (prof || profs.length > 1) linhas.push(["Com", prof ? prof.nome : "Quem estiver livre"]);
        linhas.push(["Valor", formatBRL(preco)]);
        if (cobranca > 0) linhas.push([D.tipo === "sinal" ? "Sinal agora" : "Pagar agora", formatBRL(cobranca)]);
        const aviso =
          cobranca > 0
            ? `Seu horário fica reservado por ${holdMinutos} minutos enquanto você paga por PIX na próxima tela ⏳`
            : "Pode confirmar que eu já reservo o seu horário 💖";
        if (!(await falar("resumo", { texto: "Confere se está tudo certinho 👇", resumo: { linhas } }, { texto: aviso }))) return;
        mostrar("resumo", [
          {
            layout: "lista",
            opcoes: [
              {
                id: "confirmar",
                rotulo: cobranca > 0 ? `✅ Confirmar e pagar ${formatBRL(cobranca)}` : "✅ Confirmar agendamento",
                tom: "principal",
              },
              { id: "mudar", rotulo: "✏️ Mudar o horário", tom: "neutro" },
              { id: "recomecar", rotulo: "🔄 Recomeçar", tom: "neutro" },
            ],
          },
        ]);
        return;
      }

      default:
        return;
    }
  }

  /* ----- voltar / recomeçar / encerrar ----- */
  function limparDados(etapa: Etapa) {
    const D = dados.current;
    const i = ORDEM_LIMPEZA.indexOf(etapa);
    if (i === -1) return;
    if (i <= 0) D.categoria = null;
    if (i <= 1) D.servicoId = null;
    if (i <= 2) {
      D.variacaoId = null;
      D.tipo = null;
    }
    if (i <= 3) D.profId = null;
    if (i <= 4) D.data = null;
    D.hora = null;
  }

  function voltarPara(etapa: Etapa) {
    gen.current += 1;
    setDigitando(false);
    setBandeja(null);
    setEntrada(null);
    setTexto("");
    limparDados(etapa);
    setMsgs((a) => {
      const i = a.findIndex((m) => m.etapa === etapa);
      return i === -1 ? a : a.slice(0, i);
    });
    void perguntar(etapa);
  }

  function voltarDe(etapa: Etapa) {
    const S = servicoAtual();
    const antesDoTamanho = etapaDoServico();
    if (etapa === "tamanho") return voltarPara(antesDoTamanho);
    if (etapa === "profissional") return voltarPara(S?.temTamanho ? "tamanho" : antesDoTamanho);
    if (etapa === "dia") return voltarPara(profsDo(S).length > 1 ? "profissional" : S?.temTamanho ? "tamanho" : antesDoTamanho);
    if (etapa === "hora") return voltarPara("dia");
  }

  async function encerrarSemAgendar() {
    if (
      !(await falar(
        "fim",
        {
          texto: "Sem problemas! 💖 Se quiser, é só dar uma olhadinha no nosso menu de serviços 👇",
          link: { rotulo: "Ver menu de serviços ✨", href: "/#servicos" },
        },
        {
          foto: { src: "/fotos/recorte-tchau.webp", alt: "Eliana acenando" },
          texto: "Foi um prazer falar com você! Quando quiser agendar, é só me chamar por aqui 💕",
        },
      ))
    )
      return;
    setEncerrada(true);
    mostrar("fim", [{ layout: "lista", opcoes: [{ id: "reiniciar", rotulo: "Quero fazer um agendamento? 💅", tom: "principal" }] }]);
  }

  async function iniciar(comAtalho: boolean) {
    gen.current += 1;
    setMsgs([]);
    setBandeja(null);
    setEntrada(null);
    setTexto("");
    setDigitando(false);
    setEncerrada(false);
    dados.current = dadosVazios();

    if (servicos.length === 0) {
      const zap = linkWhatsapp();
      if (!(await falar("fim", { texto: "Olá! 💖 Eu sou a assistente virtual do Espaço Beauty. Por enquanto não temos serviços abertos para agendar online 😕" }))) return;
      if (zap) mostrar("fim", [{ layout: "lista", opcoes: [{ id: "zap", rotulo: "💬 Falar com a Eliana no WhatsApp", href: zap }] }]);
      return;
    }

    const atalho = comAtalho ? (servicos.find((s) => s.slug === props.slugInicial) ?? null) : null;
    if (atalho) {
      dados.current.categoria = atalho.categoria;
      dados.current.servicoId = atalho.id;
      const ok = await falar("boasvindas", {
        texto: `Olá! 💖 Eu sou a assistente virtual do Espaço Beauty, vi que você deseja agendar o serviço *${atalho.nome}* ${emojiServico(atalho.nome, atalho.categoria)}, é isso?`,
      });
      if (!ok) return;
      mostrar("confirma", [
        {
          layout: "lista",
          opcoes: [
            { id: "sim", rotulo: "Sim, é isso! ✅", tom: "principal" },
            { id: "agora-nao", rotulo: "Não, obrigada", tom: "neutro" },
          ],
        },
      ]);
      return;
    }

    const ok = await falar("boasvindas", {
      texto: "Olá! 💖 Eu sou a assistente virtual do Espaço Beauty, vi que você deseja agendar um serviço ✨",
    });
    if (!ok) return;
    await perguntar("categoria");
  }

  /* ----- envio ----- */
  async function enviar() {
    const minha = gen.current;
    const D = dados.current;
    setDigitando(true);
    try {
      const r = await criarReservaPublica({
        servicoId: D.servicoId!,
        variacaoId: D.variacaoId,
        profissionalId: D.profId,
        data: D.data!,
        hora: D.hora!,
        nome: D.nome,
        telefone: D.telefone,
        email: D.email,
        tipoPagamento: D.tipo ?? "total",
      });
      if (minha !== gen.current) return;
      setDigitando(false);
      if (r.ok) {
        adicionar({ de: "bot", etapa: "enviando", texto: "Pronto, horário reservado! 🎉 Já vou te levar para a página da sua reserva 💕" });
        router.push(`/reserva/${r.token}`);
        return;
      }
      if (!(await falar("enviando", { texto: `Ops 😕 ${r.erro}` }))) return;
      if (/horário/i.test(r.erro)) {
        D.hora = null;
        D.data = null;
        await perguntar("dia");
        return;
      }
    } catch {
      if (minha !== gen.current) return;
      setDigitando(false);
      if (!(await falar("enviando", { texto: "Ops 😕 Algo deu errado ao reservar. Quer tentar de novo?" }))) return;
    }
    mostrar("enviando", [
      {
        layout: "lista",
        opcoes: [
          { id: "tentar", rotulo: "🔄 Tentar de novo", tom: "principal" },
          { id: "mudar", rotulo: "✏️ Mudar o horário", tom: "neutro" },
        ],
      },
    ]);
  }

  async function enviarTexto() {
    const valor = texto.trim();
    if (!entrada || !valor || digitando) return;
    const etapa = entrada;
    const D = dados.current;
    setTexto("");
    setEntrada(null);
    eu(etapa, etapa === "telefone" ? formatTelefone(valor) : valor);

    if (etapa === "nome") {
      if (!nomeValido(valor)) {
        if (await falar("nome", { texto: "Hmm, não consegui entender 😅 Pode escrever o seu nome completo?" })) pedirTexto("nome");
        return;
      }
      D.nome = valor;
    } else if (etapa === "telefone") {
      if (!telefoneValido(valor)) {
        if (await falar("telefone", { texto: "Esse telefone parece incompleto 🤔 Preciso do DDD + número, por exemplo (11) 91234-5678." }))
          pedirTexto("telefone");
        return;
      }
      D.telefone = formatTelefone(valor);
    } else {
      if (!emailValido(valor)) {
        if (await falar("email", { texto: "Esse e-mail parece estranho 🤔 Pode conferir pra mim?" })) pedirTexto("email");
        return;
      }
      D.email = valor.trim();
    }
    await perguntar(proximaEtapaDeDados());
  }

  async function escolher(etapa: Etapa, op: Opcao) {
    const D = dados.current;
    setBandeja(null);

    if (op.id === "voltar") return voltarDe(etapa);
    if (op.id === "mais") return maisDatas();
    if (op.id === "todas-horas") return mostrarHoras(true);
    if (op.id === "tentar" && etapa !== "enviando") return perguntar(etapa === "hora" ? "hora" : "dia");

    const fala = etapa === "dia" ? cap(dataPorExtenso(op.id)) : etapa === "hora" ? `Às ${op.rotulo}` : op.rotulo;
    eu(etapa, fala);

    if (op.id === "agora-nao") return encerrarSemAgendar();

    switch (etapa) {
      case "confirma":
        return depoisDoServico();
      case "categoria":
        D.categoria = op.id;
        return perguntar("servico");
      case "servico": {
        const s = servicos.find((x) => x.id === op.id);
        if (!s) return;
        D.servicoId = s.id;
        D.categoria = s.categoria;
        D.variacaoId = null;
        D.profId = null;
        D.data = null;
        D.hora = null;
        D.tipo = null;
        return depoisDoServico();
      }
      case "tamanho":
        D.variacaoId = op.id;
        return depoisDoTamanho();
      case "profissional":
        D.profId = op.id === "qualquer" ? null : op.id;
        return perguntar("dia");
      case "dia":
        D.data = op.id;
        D.hora = null;
        return perguntar("hora");
      case "hora":
        D.hora = op.id;
        return perguntar(proximaEtapaDeDados());
      case "pagamento":
        D.tipo = op.id === "sinal" ? "sinal" : "total";
        return perguntar("resumo");
      case "resumo":
      case "enviando":
        if (op.id === "confirmar" || op.id === "tentar") return enviar();
        if (op.id === "mudar") return voltarPara("dia");
        return iniciar(false);
      case "fim":
        if (op.id !== "reiniciar") return;
        setEncerrada(false);
        dados.current = dadosVazios();
        if (!(await falar("boasvindas", { texto: "Que bom! 🥰 Vamos agendar o seu horário?" }))) return;
        return perguntar("categoria");
      default:
        return;
    }
  }

  /* ----- efeitos ----- */
  useEffect(() => {
    void iniciar(true);
    return () => {
      gen.current += 1;
    };
    // roda uma vez; o conteúdo vem das props, que não mudam durante a conversa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rola para o fim; se as opções forem altas demais, mostra o começo da pergunta
  useEffect(() => {
    const cont = rolagem.current;
    if (!cont) return;
    const comportamento: ScrollBehavior = reduzMovimento() ? "auto" : "smooth";
    const ultima = Array.from(cont.querySelectorAll<HTMLElement>("[data-balao]")).at(-1);
    const opcoes = bandejaRef.current;
    if (opcoes && ultima) {
      const altoDemais = opcoes.getBoundingClientRect().bottom - ultima.getBoundingClientRect().top > cont.clientHeight - 16;
      if (altoDemais) {
        cont.scrollTo({ top: ultima.offsetTop - 12, behavior: comportamento });
        return;
      }
    }
    fim.current?.scrollIntoView({ behavior: comportamento, block: "end" });
  }, [msgs, digitando, bandeja]);

  useEffect(() => {
    if (entrada && !digitando) campo.current?.focus({ preventScroll: true });
  }, [entrada, digitando]);

  // no celular, acompanha o teclado: o chat encolhe e o campo de resposta continua à vista
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setViewport(mq.matches ? { h: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null);
    atualizar();
    vv.addEventListener("resize", atualizar);
    vv.addEventListener("scroll", atualizar);
    mq.addEventListener("change", atualizar);
    return () => {
      vv.removeEventListener("resize", atualizar);
      vv.removeEventListener("scroll", atualizar);
      mq.removeEventListener("change", atualizar);
    };
  }, []);

  const placeholder =
    entrada === "nome"
      ? "Digite o seu nome completo"
      : entrada === "telefone"
        ? "(11) 91234-5678"
        : entrada === "email"
          ? "voce@exemplo.com"
          : encerrada
            ? "Conversa encerrada"
            : "Toque em uma das opções 👆";

  return (
    <section
      aria-label="Agendamento por conversa"
      style={viewport ? { height: viewport.h, top: viewport.top, bottom: "auto" } : undefined}
      className="fixed inset-0 z-50 flex flex-col bg-perola-2 md:static md:z-auto md:mx-auto md:h-[min(46rem,calc(100dvh-9rem))] md:w-full md:max-w-md md:overflow-hidden md:rounded-[2rem] md:border md:border-linha md:shadow-camarim"
    >
      <header className="no-escuro flex items-center gap-2.5 bg-ameixa px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-perola">
        <Link
          href="/"
          aria-label="Voltar para o site"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:hidden"
        >
          <IconeSeta />
        </Link>
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ambar to-ambar-2 font-display text-lg font-medium italic text-ameixa max-md:-ml-1 md:ml-2"
        >
          EB
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">Espaço Beauty</p>
          <p className="truncate text-xs text-cha" aria-live="polite">
            {digitando ? "digitando…" : encerrada ? "conversa encerrada" : "assistente virtual · online"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void iniciar(false)}
          aria-label="Recomeçar a conversa"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:mr-2"
        >
          <IconeRecomecar />
        </button>
      </header>

      <div ref={rolagem} className="chat-fundo min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <p className="mx-auto mb-3 w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-suave shadow-sm">Hoje</p>
        <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-1.5">
          {msgs.map((m) => (
            <Balao key={m.id} m={m} />
          ))}
          {digitando ? <Digitando /> : null}
        </div>
        {bandeja && !digitando ? (
          <div ref={bandejaRef} className="mt-2">
            <Opcoes bandeja={bandeja} onEscolher={(o) => void escolher(bandeja.etapa, o)} />
          </div>
        ) : null}
        <div ref={fim} aria-hidden />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviarTexto();
        }}
        className="flex items-center gap-2 border-t border-linha bg-perola px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(entrada === "telefone" ? formatTelefone(e.target.value) : e.target.value)}
          disabled={!entrada || digitando}
          placeholder={placeholder}
          aria-label={entrada === "nome" ? "Seu nome" : entrada === "telefone" ? "Seu telefone" : entrada === "email" ? "Seu e-mail" : "Campo de resposta"}
          inputMode={entrada === "telefone" ? "tel" : entrada === "email" ? "email" : "text"}
          autoComplete={entrada === "nome" ? "name" : entrada === "telefone" ? "tel" : entrada === "email" ? "email" : "off"}
          enterKeyHint="send"
          maxLength={120}
          className="campo min-h-11 flex-1 rounded-full px-4 py-2 disabled:bg-white/60"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!entrada || !texto.trim() || digitando}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-framboesa text-white transition hover:bg-framboesa-2 disabled:opacity-40"
        >
          <IconeEnviar />
        </button>
      </form>
    </section>
  );
}
