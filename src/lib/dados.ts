import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Config, Horario, Profissional, Servico, Variacao } from "@/lib/tipos";

function falhou(contexto: string, erro: { message: string; code?: string } | null): never {
  const dica =
    erro?.code === "PGRST106" || /schema/i.test(erro?.message ?? "")
      ? " (o schema 'beauty' precisa estar em Settings > API > Exposed schemas no Supabase)"
      : "";
  throw new Error(`${contexto}: ${erro?.message ?? "erro desconhecido"}${dica}`);
}

export async function getConfig(): Promise<Config> {
  const { data, error } = await db().from("configuracoes").select("*").eq("id", 1).single();
  if (error || !data) falhou("Falha ao ler configurações", error);
  return { ...data, sinal_percentual: Number(data.sinal_percentual) } as Config;
}

type LinhaServico = Omit<Servico, "variacoes" | "profissionais" | "preco_base"> & {
  preco_base: number | string;
  variacoes: Variacao[] | null;
  vinculos: { profissional_id: string }[] | null;
};

const ORDEM_TAMANHO = { curto: 0, medio: 1, longo: 2 } as const;

function mapServico(l: LinhaServico): Servico {
  const { vinculos, variacoes, preco_base, ...resto } = l;
  return {
    ...resto,
    preco_base: Number(preco_base),
    passos: l.passos ?? [],
    variacoes: (variacoes ?? [])
      .map((v) => ({ ...v, preco: Number(v.preco) }))
      .sort((a, b) => ORDEM_TAMANHO[a.tamanho] - ORDEM_TAMANHO[b.tamanho]),
    profissionais: (vinculos ?? []).map((v) => v.profissional_id),
  };
}

const SELECT_SERVICO = "*, variacoes:variacoes_servico(*), vinculos:servico_profissionais(profissional_id)";

export async function listarServicos(opts: { incluirInativos?: boolean } = {}): Promise<Servico[]> {
  let q = db().from("servicos").select(SELECT_SERVICO).order("ordem").order("nome");
  if (!opts.incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) falhou("Falha ao listar serviços", error);
  return (data as unknown as LinhaServico[]).map(mapServico);
}

export async function getServico(id: string): Promise<Servico | null> {
  const { data, error } = await db().from("servicos").select(SELECT_SERVICO).eq("id", id).maybeSingle();
  if (error) falhou("Falha ao ler serviço", error);
  return data ? mapServico(data as unknown as LinhaServico) : null;
}

export async function listarProfissionais(opts: { incluirInativos?: boolean } = {}): Promise<Profissional[]> {
  let q = db().from("profissionais").select("*").order("ordem").order("nome");
  if (!opts.incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) falhou("Falha ao listar profissionais", error);
  return data as Profissional[];
}

export async function listarHorarios(): Promise<Horario[]> {
  const { data, error } = await db().from("horarios_trabalho").select("*");
  if (error) falhou("Falha ao ler horários de trabalho", error);
  return (data as Horario[]).map((h) => ({
    ...h,
    inicio: h.inicio.slice(0, 5),
    fim: h.fim.slice(0, 5),
    almoco_inicio: h.almoco_inicio?.slice(0, 5) ?? null,
    almoco_fim: h.almoco_fim?.slice(0, 5) ?? null,
  }));
}

export { falhou };
