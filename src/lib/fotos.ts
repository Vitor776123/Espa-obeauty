/** Fotos do salão guardadas em /public/fotos. Elas valem para os serviços da lista; serviços novos usam a foto enviada pelo painel. */
const POR_SLUG = new Set([
  "pe",
  "mao",
  "pe-e-mao",
  "spa-dos-pes",
  "plastica-dos-pes",
  "corte-e-escova",
  "corte",
  "escova",
  "progressiva",
  "cronograma-capilar",
  "relaxamento",
  "tintura-raiz-e-escova",
  "tintura-completa-e-escova",
  "botox",
  "progressiva-organica",
  "sobrancelha",
  "buco",
]);

export function fotoDoServico(slug: string, enviada: string | null): string | null {
  return POR_SLUG.has(slug) ? `/fotos/${slug}.webp` : enviada;
}
