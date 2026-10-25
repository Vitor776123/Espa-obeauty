/** Funções puras de cobrança (podem ser usadas no navegador). */
export function calcularCobranca(total: number, tipo: "sinal" | "total" | "no_local", pct: number): number {
  if (tipo === "no_local") return 0;
  if (tipo === "total") return Math.round(total * 100) / 100;
  return Math.round(total * (pct / 100) * 100) / 100;
}
