export type Config = {
  nome_salao: string;
  responsavel: string;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  sinal_percentual: number;
  hold_minutos: number;
  slot_min: number;
  antecedencia_min_horas: number;
  limite_cancelamento_horas: number;
  janela_dias: number;
  chave_pix: string | null;
  pix_favorecido: string | null;
};

export type Tamanho = "curto" | "medio" | "longo";

export type Variacao = {
  id: string;
  servico_id: string;
  tamanho: Tamanho;
  preco: number;
  duracao_min: number;
};

export type Servico = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  descricao_longa: string | null;
  foto_url: string | null;
  passos: string[];
  preco_base: number;
  duracao_min: number;
  tem_tamanho: boolean;
  ativo: boolean;
  ordem: number;
  variacoes: Variacao[];
  profissionais: string[]; // ids
};

export type Profissional = {
  id: string;
  nome: string;
  bio: string | null;
  foto_url: string | null;
  cor: string;
  ativo: boolean;
  ordem: number;
};

export type Horario = {
  id: string;
  profissional_id: string;
  dia_semana: number;
  inicio: string;
  fim: string;
  almoco_inicio: string | null;
  almoco_fim: string | null;
};

export type StatusAgendamento =
  | "aguardando_pagamento"
  | "pendente"
  | "confirmado"
  | "concluido"
  | "cancelado"
  | "expirado"
  | "faltou";

export type StatusPagamento = "pendente" | "sinal_pago" | "pago_total" | "reembolsado";

export type Agendamento = {
  id: string;
  cliente_id: string;
  profissional_id: string;
  servico_id: string;
  variacao_id: string | null;
  data: string;
  inicio: string;
  fim: string;
  duracao_total: number;
  valor_total: number;
  valor_pago: number;
  tipo_pagamento: "sinal" | "total" | "no_local";
  pagamento_status: StatusPagamento;
  status: StatusAgendamento;
  observacoes: string | null;
  origem: "site" | "equipe";
  token_gerenciar: string;
  expira_em: string | null;
  created_at: string;
};

export type AgendamentoCompleto = Agendamento & {
  cliente: { id: string; nome: string; telefone: string; email: string | null };
  servico: { id: string; nome: string };
  variacao: { tamanho: Tamanho } | null;
  profissional: { id: string; nome: string; cor: string };
};

export const STATUS_ATIVOS: StatusAgendamento[] = ["aguardando_pagamento", "pendente", "confirmado", "concluido"];

export const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pendente: "Aguardando conferência",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  expirado: "Expirado",
  faltou: "Não compareceu",
};

export const ROTULO_PAGAMENTO: Record<StatusPagamento, string> = {
  pendente: "Sem pagamento",
  sinal_pago: "Sinal pago",
  pago_total: "Pago",
  reembolsado: "Reembolsado",
};

export const ROTULO_TAMANHO: Record<Tamanho, string> = {
  curto: "Cabelo curto",
  medio: "Cabelo médio",
  longo: "Cabelo longo",
};
