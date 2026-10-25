// Utilidades de data/hora no fuso de São Paulo (sem horário de verão desde 2019).
// Datas são strings "YYYY-MM-DD" e horas "HH:MM" para evitar surpresas de fuso.

export const FUSO = "America/Sao_Paulo";

export function hhmmParaMin(h: string): number {
  const [hh, mm] = h.slice(0, 5).split(":").map(Number);
  return hh * 60 + mm;
}

export function minParaHhmm(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Agora, no relógio de São Paulo. */
export function agoraSP(base: Date = new Date()): { data: string; min: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(base);
  const get = (t: string) => partes.find((p) => p.type === t)!.value;
  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    min: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function hojeSP(): string {
  return agoraSP().data;
}

/** Soma dias a uma data ISO (aritmética em UTC, imune a fuso). */
export function somarDias(data: string, dias: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(data: string): number {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Instante UTC de uma data+hora de São Paulo (UTC−3 fixo). */
export function instanteSP(data: string, hhmm: string): Date {
  const [y, m, d] = data.split("-").map(Number);
  const min = hhmmParaMin(hhmm);
  return new Date(Date.UTC(y, m - 1, d, 0, min + 3 * 60));
}

const DIAS_LONGOS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const nomeDia = (i: number) => DIAS_LONGOS[i];
export const nomeDiaCurto = (i: number) => DIAS_CURTOS[i];
export const nomeMes = (i: number) => MESES[i];

/** "sexta-feira, 24 de outubro" */
export function dataPorExtenso(data: string): string {
  const [, m, d] = data.split("-").map(Number);
  return `${DIAS_LONGOS[diaDaSemana(data)]}, ${d} de ${MESES[m - 1]}`;
}

/** "24/10/2026" */
export function dataCurta(data: string): string {
  const [y, m, d] = data.split("-");
  return `${d}/${m}/${y}`;
}

export function formatBRL(v: number | string): string {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuracao(min: number): string {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function formatTelefone(s: string): string {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
