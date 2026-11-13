import { diaDaSemana, nomeDiaCurto, somarDias, soDigitos } from "@/lib/tempo";

/** Funções puras do chat de agendamento (testáveis e usadas no navegador). */

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Emoji que combina com o serviço. A ordem importa: "Tintura + Escova" é tintura, "Corte e Escova" é corte. */
export function emojiServico(nome: string, categoria = ""): string {
  const n = normalizar(nome);
  if (/cilio/.test(n)) return "👁️";
  if (/sobrancelha/.test(n)) return "👁️";
  if (/\b(buco)\b/.test(n)) return "🌸";
  if (/tintura|coloracao|luzes|mecha|descoloracao|morena iluminada/.test(n)) return "🎨";
  if (/corte/.test(n)) return "✂️";
  if (/\b(pe|pes|mao|maos)\b|unha|manicure|pedicure|esmalt/.test(n)) return "💅";
  if (/escova|penteado|chapinha|babyliss/.test(n)) return "💇‍♀️";
  if (/progressiva|botox|relaxamento|cronograma|hidrata|alisamento|reconstrucao|nutricao|selagem/.test(n)) return "💆‍♀️";
  return categoria ? emojiCategoria(categoria) : "💖";
}

export function emojiCategoria(categoria: string): string {
  const c = normalizar(categoria);
  if (/unha/.test(c)) return "💅";
  if (/sobrancelha|buco|cilio/.test(c)) return "👁️";
  if (/coloracao|tintura/.test(c)) return "🎨";
  if (/cabelo/.test(c)) return "💇‍♀️";
  if (/tratamento/.test(c)) return "💆‍♀️";
  return "✨";
}

/** "Hoje · 13/11", "Amanhã · 14/11", "Sáb · 15/11" */
export function rotuloDia(data: string, hoje: string): string {
  const [, m, d] = data.split("-");
  const curta = `${d}/${m}`;
  if (data === hoje) return `Hoje · ${curta}`;
  if (data === somarDias(hoje, 1)) return `Amanhã · ${curta}`;
  const dia = nomeDiaCurto(diaDaSemana(data));
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${curta}`;
}

export type GrupoDeHoras = { titulo: string; emoji: string; horas: string[] };

/** Separa os horários livres em manhã, tarde e noite (grupos vazios somem). */
export function agruparHoras(horas: string[]): GrupoDeHoras[] {
  const ordenadas = [...horas].sort();
  const grupos: GrupoDeHoras[] = [
    { titulo: "Manhã", emoji: "☀️", horas: ordenadas.filter((h) => h < "12:00") },
    { titulo: "Tarde", emoji: "🌤️", horas: ordenadas.filter((h) => h >= "12:00" && h < "18:00") },
    { titulo: "Noite", emoji: "🌙", horas: ordenadas.filter((h) => h >= "18:00") },
  ];
  return grupos.filter((g) => g.horas.length > 0);
}

export function nomeValido(nome: string): boolean {
  const n = nome.trim();
  return n.length >= 2 && n.length <= 120 && /\p{L}{2,}/u.test(n);
}

export function telefoneValido(tel: string): boolean {
  const n = soDigitos(tel).length;
  return n === 10 || n === 11;
}

export function emailValido(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p ? `${p.charAt(0).toLocaleUpperCase("pt-BR")}${p.slice(1)}` : "";
}

/** Quanto tempo o "digitando…" dura, proporcional ao tamanho da mensagem. */
export function atrasoDigitando(texto: string, reduzirMovimento: boolean): number {
  if (reduzirMovimento) return 0;
  return Math.min(1100, 450 + texto.length * 12);
}
