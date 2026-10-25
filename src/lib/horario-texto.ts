import { hhmmParaMin, nomeDiaCurto } from "@/lib/tempo";
import type { Horario } from "@/lib/tipos";

function h(hhmm: string) {
  const min = hhmmParaMin(hhmm);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Seg a sáb, 10h às 19h" — junta dias seguidos com o mesmo expediente. */
export function resumoHorario(horarios: Horario[]): string[] {
  const porDia: (string | null)[] = [];
  for (let d = 0; d < 7; d++) {
    const doDia = horarios.filter((x) => x.dia_semana === d);
    if (!doDia.length) {
      porDia.push(null);
      continue;
    }
    const ini = doDia.map((x) => x.inicio).sort()[0];
    const fim = doDia.map((x) => x.fim).sort().at(-1)!;
    porDia.push(`${h(ini)} às ${h(fim)}`);
  }
  // ordem de exibição: segunda … domingo
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const grupos: { dias: number[]; txt: string }[] = [];
  for (const d of ordem) {
    const txt = porDia[d];
    if (!txt) continue;
    const ultimo = grupos.at(-1);
    const idxAnterior = ultimo ? ordem.indexOf(ultimo.dias.at(-1)!) : -2;
    if (ultimo && ultimo.txt === txt && idxAnterior === ordem.indexOf(d) - 1) ultimo.dias.push(d);
    else grupos.push({ dias: [d], txt });
  }
  return grupos.map((g) => {
    const a = cap(nomeDiaCurto(g.dias[0]));
    const z = nomeDiaCurto(g.dias.at(-1)!);
    const dias = g.dias.length === 1 ? a : g.dias.length === 2 ? `${a} e ${z}` : `${a} a ${z}`;
    return `${dias}, ${g.txt}`;
  });
}
