import { hhmmParaMin, minParaHhmm } from "./tempo";

export type Intervalo = { inicio: number; fim: number }; // minutos desde 00:00

export type Expediente = {
  inicio: string; // "HH:MM"
  fim: string;
  almoco_inicio?: string | null;
  almoco_fim?: string | null;
};

/** Janelas livres de trabalho no dia (antes e depois do almoço). */
export function janelasDoDia(exp: Expediente): Intervalo[] {
  const ini = hhmmParaMin(exp.inicio);
  const fim = hhmmParaMin(exp.fim);
  if (exp.almoco_inicio && exp.almoco_fim) {
    const ai = hhmmParaMin(exp.almoco_inicio);
    const af = hhmmParaMin(exp.almoco_fim);
    return [
      { inicio: ini, fim: ai },
      { inicio: af, fim },
    ].filter((j) => j.fim > j.inicio);
  }
  return [{ inicio: ini, fim }];
}

export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

export type EntradaSlots = {
  duracao: number; // minutos
  expediente: Expediente | null; // null = não trabalha neste dia
  ocupados: Intervalo[]; // agendamentos ativos + bloqueios
  passoMin: number; // granularidade (ex.: 10)
  /** Só horários que começam a partir deste minuto (usado para "hoje" + antecedência). */
  minimoInicio?: number;
};

/** Horários de início possíveis ("HH:MM"), em ordem crescente. */
export function gerarSlots(e: EntradaSlots): string[] {
  if (!e.expediente || e.duracao <= 0) return [];
  const saida: string[] = [];
  for (const j of janelasDoDia(e.expediente)) {
    // alinha o primeiro candidato ao passo, a partir do início da janela
    for (let s = j.inicio; s + e.duracao <= j.fim; s += e.passoMin) {
      if (e.minimoInicio !== undefined && s < e.minimoInicio) continue;
      const cand = { inicio: s, fim: s + e.duracao };
      if (e.ocupados.some((o) => sobrepoe(cand, o))) continue;
      saida.push(minParaHhmm(s));
    }
  }
  return saida;
}

/** Verifica se um horário específico ainda cabe (usado na hora de reservar). */
export function cabe(e: Omit<EntradaSlots, "passoMin"> & { inicio: string }): boolean {
  if (!e.expediente || e.duracao <= 0) return false;
  const s = hhmmParaMin(e.inicio);
  const cand = { inicio: s, fim: s + e.duracao };
  if (e.minimoInicio !== undefined && s < e.minimoInicio) return false;
  const naJanela = janelasDoDia(e.expediente).some((j) => cand.inicio >= j.inicio && cand.fim <= j.fim);
  if (!naJanela) return false;
  return !e.ocupados.some((o) => sobrepoe(cand, o));
}
