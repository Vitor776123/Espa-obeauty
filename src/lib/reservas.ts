import "server-only";
import { db } from "@/lib/supabase/admin";
import { getConfig, getServico, listarHorarios, listarProfissionais } from "@/lib/dados";
import { calcularCobranca } from "@/lib/cobranca";
import { gerarSlots, type Intervalo } from "@/lib/slots";
import {
  agoraSP,
  dataValida,
  diaDaSemana,
  hhmmParaMin,
  instanteSP,
  minParaHhmm,
  somarDias,
  soDigitos,
} from "@/lib/tempo";
import {
  STATUS_ATIVOS,
  type Agendamento,
  type AgendamentoCompleto,
  type Servico,
  type Variacao,
} from "@/lib/tipos";

/* ------------------------------------------------------------------ */
/* Oferta (serviço + tamanho) — preço e duração SEMPRE vêm do banco      */
/* ------------------------------------------------------------------ */

export type Oferta = { servico: Servico; variacao: Variacao | null; preco: number; duracao: number };

export async function resolverOferta(servicoId: string, variacaoId: string | null): Promise<Oferta | null> {
  const servico = await getServico(servicoId);
  if (!servico || !servico.ativo) return null;
  if (servico.tem_tamanho) {
    const variacao = servico.variacoes.find((v) => v.id === variacaoId);
    if (!variacao) return null;
    return { servico, variacao, preco: variacao.preco, duracao: variacao.duracao_min };
  }
  if (servico.duracao_min <= 0) return null;
  return { servico, variacao: null, preco: servico.preco_base, duracao: servico.duracao_min };
}

/* ------------------------------------------------------------------ */
/* Disponibilidade                                                      */
/* ------------------------------------------------------------------ */

/** data → hora → ids das profissionais livres naquele horário */
export type MapaDisponibilidade = Record<string, Record<string, string[]>>;

type LinhaOcupada = {
  profissional_id: string;
  data: string;
  inicio: string;
  fim: string;
  status: string;
  expira_em: string | null;
  id: string;
};

/** Libera horários presos por pagamentos que não aconteceram. */
export async function expirarVencidas(): Promise<number> {
  const { data } = await db()
    .from("agendamentos")
    .update({ status: "expirado" })
    .eq("status", "aguardando_pagamento")
    .lt("expira_em", new Date().toISOString())
    .select("id");
  return data?.length ?? 0;
}

export async function calcularDisponibilidade(p: {
  oferta: Oferta;
  profissionalId?: string | null;
  de: string;
  ate: string;
  ignorarAgendamentoId?: string;
  ignorarAntecedencia?: boolean;
}): Promise<MapaDisponibilidade> {
  const [cfg, profs, horarios] = await Promise.all([getConfig(), listarProfissionais(), listarHorarios()]);
  const agora = agoraSP();

  const elegiveis = profs.filter(
    (pr) =>
      p.oferta.servico.profissionais.includes(pr.id) && (!p.profissionalId || pr.id === p.profissionalId),
  );
  if (!elegiveis.length) return {};

  // limites: nunca no passado, nunca além da janela de agendamento
  const maximo = somarDias(agora.data, cfg.janela_dias);
  const de = p.de < agora.data ? agora.data : p.de;
  const ate = p.ate > maximo ? maximo : p.ate;
  if (de > ate) return {};

  const [{ data: ags, error: e1 }, { data: bls, error: e2 }] = await Promise.all([
    db()
      .from("agendamentos")
      .select("id, profissional_id, data, inicio, fim, status, expira_em")
      .gte("data", de)
      .lte("data", ate)
      .in("status", STATUS_ATIVOS),
    db().from("bloqueios").select("profissional_id, data, inicio, fim").gte("data", de).lte("data", ate),
  ]);
  if (e1) throw new Error(`Falha ao ler agendamentos: ${e1.message}`);
  if (e2) throw new Error(`Falha ao ler bloqueios: ${e2.message}`);

  const agoraMs = Date.now();
  const ativos = (ags as LinhaOcupada[]).filter((a) => {
    if (a.id === p.ignorarAgendamentoId) return false;
    if (a.status === "aguardando_pagamento" && a.expira_em && new Date(a.expira_em).getTime() <= agoraMs) return false;
    return true;
  });

  const mapa: MapaDisponibilidade = {};
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    const dow = diaDaSemana(dia);
    const minimo =
      dia === agora.data && !p.ignorarAntecedencia ? agora.min + cfg.antecedencia_min_horas * 60 : undefined;

    for (const pr of elegiveis) {
      const exp = horarios.find((h) => h.profissional_id === pr.id && h.dia_semana === dow);
      if (!exp) continue;
      const ocupados: Intervalo[] = [
        ...ativos
          .filter((a) => a.profissional_id === pr.id && a.data === dia)
          .map((a) => ({ inicio: hhmmParaMin(a.inicio), fim: hhmmParaMin(a.fim) })),
        ...(bls ?? [])
          .filter((b) => b.data === dia && (!b.profissional_id || b.profissional_id === pr.id))
          .map((b) => ({ inicio: hhmmParaMin(b.inicio), fim: hhmmParaMin(b.fim) })),
      ];
      const slots = gerarSlots({
        duracao: p.oferta.duracao,
        expediente: exp,
        ocupados,
        passoMin: cfg.slot_min,
        minimoInicio: minimo,
      });
      for (const hora of slots) {
        ((mapa[dia] ??= {})[hora] ??= []).push(pr.id);
      }
    }
  }
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Clientes                                                             */
/* ------------------------------------------------------------------ */

export function normalizarTelefone(bruto: string): string | null {
  let d = soDigitos(bruto);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

async function garantirCliente(c: { nome: string; telefone: string; email: string | null }) {
  const existente = await db().from("clientes").select("id, nome, email").eq("telefone", c.telefone).maybeSingle();
  if (existente.error) throw new Error(`Falha ao ler cliente: ${existente.error.message}`);
  if (existente.data) {
    const patch: Record<string, string> = {};
    if (c.nome && c.nome !== existente.data.nome) patch.nome = c.nome;
    if (c.email && c.email !== existente.data.email) patch.email = c.email;
    if (Object.keys(patch).length) await db().from("clientes").update(patch).eq("id", existente.data.id);
    return existente.data.id as string;
  }
  const novo = await db()
    .from("clientes")
    .insert({ nome: c.nome, telefone: c.telefone, email: c.email })
    .select("id")
    .single();
  if (novo.error) throw new Error(`Falha ao criar cliente: ${novo.error.message}`);
  return novo.data.id as string;
}

/* ------------------------------------------------------------------ */
/* Reservar                                                             */
/* ------------------------------------------------------------------ */

export type EntradaReserva = {
  servicoId: string;
  variacaoId: string | null;
  profissionalId: string | null; // null = qualquer disponível
  data: string;
  hora: string;
  cliente: { nome: string; telefone: string; email: string | null };
  tipoPagamento: "sinal" | "total" | "no_local";
  origem: "site" | "equipe";
  observacoes?: string | null;
  /** Equipe pode agendar para daqui a pouco; o site respeita a antecedência mínima. */
  ignorarAntecedencia?: boolean;
};

export type ResultadoReserva =
  | { ok: true; agendamento: Agendamento; valorACobrar: number }
  | { ok: false; erro: string };

export { calcularCobranca };

export async function reservar(e: EntradaReserva): Promise<ResultadoReserva> {
  if (!dataValida(e.data) || !/^\d{2}:\d{2}$/.test(e.hora)) return { ok: false, erro: "Data ou horário inválido." };
  const telefone = normalizarTelefone(e.cliente.telefone);
  if (!telefone) return { ok: false, erro: "Informe um telefone com DDD." };
  const nome = e.cliente.nome.trim();
  if (nome.length < 2) return { ok: false, erro: "Informe seu nome." };

  const oferta = await resolverOferta(e.servicoId, e.variacaoId);
  if (!oferta) return { ok: false, erro: "Esse serviço não está disponível agora." };

  await expirarVencidas();
  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: e.profissionalId,
    de: e.data,
    ate: e.data,
    ignorarAntecedencia: e.ignorarAntecedencia,
  });
  const candidatas = mapa[e.data]?.[e.hora];
  if (!candidatas?.length) return { ok: false, erro: "Esse horário acabou de ser reservado. Escolha outro." };

  // Escolhe a profissional com menos atendimentos no dia (empate: a primeira da lista)
  let profissionalId = candidatas[0];
  if (candidatas.length > 1) {
    const { data: doDia } = await db()
      .from("agendamentos")
      .select("profissional_id")
      .eq("data", e.data)
      .in("status", STATUS_ATIVOS);
    const contagem = new Map<string, number>();
    for (const l of doDia ?? []) contagem.set(l.profissional_id, (contagem.get(l.profissional_id) ?? 0) + 1);
    profissionalId = [...candidatas].sort((a, b) => (contagem.get(a) ?? 0) - (contagem.get(b) ?? 0))[0];
  }

  const cfg = await getConfig();
  const clienteId = await garantirCliente({ nome, telefone, email: e.cliente.email?.trim() || null });

  // Evita "segurar" vários horários sem pagar: no máximo 2 reservas aguardando pagamento por cliente
  if (e.origem === "site") {
    const { count } = await db()
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("status", "aguardando_pagamento")
      .gt("expira_em", new Date().toISOString());
    if ((count ?? 0) >= 2) {
      return {
        ok: false,
        erro: "Você já tem reservas aguardando pagamento. Conclua uma delas ou espere alguns minutos para reservar de novo.",
      };
    }
  }

  const tipo = oferta.preco <= 0 ? "no_local" : e.tipoPagamento;
  const cobranca = calcularCobranca(oferta.preco, tipo, cfg.sinal_percentual);
  const semCobranca = cobranca <= 0;
  const inicioMin = hhmmParaMin(e.hora);

  const status = semCobranca ? (e.origem === "equipe" ? "confirmado" : "pendente") : "aguardando_pagamento";
  const expiraEm = status === "aguardando_pagamento" ? new Date(Date.now() + cfg.hold_minutos * 60_000).toISOString() : null;

  const ins = await db()
    .from("agendamentos")
    .insert({
      cliente_id: clienteId,
      profissional_id: profissionalId,
      servico_id: oferta.servico.id,
      variacao_id: oferta.variacao?.id ?? null,
      data: e.data,
      inicio: e.hora,
      fim: minParaHhmm(inicioMin + oferta.duracao),
      duracao_total: oferta.duracao,
      valor_total: oferta.preco,
      tipo_pagamento: tipo,
      status,
      expira_em: expiraEm,
      origem: e.origem,
      observacoes: e.observacoes ?? null,
    })
    .select("*")
    .single();

  if (ins.error) {
    if (ins.error.code === "23P01") return { ok: false, erro: "Esse horário acabou de ser reservado. Escolha outro." };
    throw new Error(`Falha ao criar agendamento: ${ins.error.message}`);
  }
  return { ok: true, agendamento: normalizarAgendamento(ins.data), valorACobrar: cobranca };
}

/* ------------------------------------------------------------------ */
/* Leitura por token (link da cliente)                                  */
/* ------------------------------------------------------------------ */

const SELECT_COMPLETO =
  "*, cliente:clientes(id, nome, telefone, email), servico:servicos(id, nome), variacao:variacoes_servico(tamanho), profissional:profissionais(id, nome, cor)";

export function normalizarAgendamento<T extends Record<string, unknown>>(l: T): Agendamento {
  const a = l as unknown as Agendamento;
  return {
    ...a,
    inicio: a.inicio.slice(0, 5),
    fim: a.fim.slice(0, 5),
    valor_total: Number(a.valor_total),
    valor_pago: Number(a.valor_pago),
  };
}

export async function agendamentoPorToken(token: string): Promise<AgendamentoCompleto | null> {
  if (!/^[a-f0-9]{36}$/.test(token)) return null;
  const { data, error } = await db().from("agendamentos").select(SELECT_COMPLETO).eq("token_gerenciar", token).maybeSingle();
  if (error) throw new Error(`Falha ao ler reserva: ${error.message}`);
  return data ? (normalizarAgendamento(data) as AgendamentoCompleto) : null;
}

export async function agendamentoPorId(id: string): Promise<AgendamentoCompleto | null> {
  const { data, error } = await db().from("agendamentos").select(SELECT_COMPLETO).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler agendamento: ${error.message}`);
  return data ? (normalizarAgendamento(data) as AgendamentoCompleto) : null;
}

/* ------------------------------------------------------------------ */
/* Cancelar / remarcar pela cliente                                     */
/* ------------------------------------------------------------------ */

/** Horas que faltam para o atendimento (negativo se já passou). */
export function horasAte(a: Pick<Agendamento, "data" | "inicio">): number {
  return (instanteSP(a.data, a.inicio).getTime() - Date.now()) / 3_600_000;
}

export async function podeAlterar(a: Agendamento): Promise<{ pode: boolean; motivo?: string }> {
  const cfg = await getConfig();
  if (!["aguardando_pagamento", "pendente", "confirmado"].includes(a.status)) {
    return { pode: false, motivo: "Esta reserva não pode mais ser alterada." };
  }
  if (horasAte(a) < cfg.limite_cancelamento_horas) {
    return {
      pode: false,
      motivo: `Alterações pelo site são aceitas até ${cfg.limite_cancelamento_horas}h antes do horário. Fale com a gente pelo WhatsApp.`,
    };
  }
  return { pode: true };
}

export async function cancelarPorCliente(token: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await agendamentoPorToken(token);
  if (!ag) return { ok: false, erro: "Reserva não encontrada." };
  const perm = await podeAlterar(ag);
  if (!perm.pode) return { ok: false, erro: perm.motivo };
  const { error } = await db().from("agendamentos").update({ status: "cancelado", expira_em: null }).eq("id", ag.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function remarcarPorCliente(token: string, data: string, hora: string): Promise<{ ok: boolean; erro?: string }> {
  const ag = await agendamentoPorToken(token);
  if (!ag) return { ok: false, erro: "Reserva não encontrada." };
  const perm = await podeAlterar(ag);
  if (!perm.pode) return { ok: false, erro: perm.motivo };
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };

  const oferta = await resolverOferta(ag.servico_id, ag.variacao_id);
  if (!oferta) return { ok: false, erro: "Esse serviço não está mais disponível. Fale com a gente pelo WhatsApp." };

  const mapa = await calcularDisponibilidade({
    oferta,
    profissionalId: ag.profissional_id,
    de: data,
    ate: data,
    ignorarAgendamentoId: ag.id,
  });
  if (!mapa[data]?.[hora]?.includes(ag.profissional_id)) {
    return { ok: false, erro: "Esse horário não está mais livre. Escolha outro." };
  }

  const { error } = await db()
    .from("agendamentos")
    .update({ data, inicio: hora, fim: minParaHhmm(hhmmParaMin(hora) + ag.duracao_total) })
    .eq("id", ag.id);
  if (error) {
    if (error.code === "23P01") return { ok: false, erro: "Esse horário acabou de ser reservado. Escolha outro." };
    throw new Error(error.message);
  }
  return { ok: true };
}

