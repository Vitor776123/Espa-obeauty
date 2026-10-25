-- =====================================================================
-- Espaço Beauty — schema isolado "beauty" dentro do projeto Leonidas.
-- Nada aqui toca em public/Pandora. Acesso só via service_role (servidor).
-- =====================================================================

create schema if not exists beauty;
create extension if not exists btree_gist with schema extensions;

-- ---------- Tipos ----------
do $$ begin
  create type beauty.agendamento_status as enum
    ('aguardando_pagamento','pendente','confirmado','concluido','cancelado','expirado','faltou');
exception when duplicate_object then null; end $$;

do $$ begin
  create type beauty.pagamento_status as enum
    ('pendente','sinal_pago','pago_total','reembolsado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type beauty.tipo_pagamento as enum ('sinal','total','no_local');
exception when duplicate_object then null; end $$;

do $$ begin
  create type beauty.papel_equipe as enum ('admin','profissional');
exception when duplicate_object then null; end $$;

-- ---------- updated_at ----------
create or replace function beauty.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Configurações (linha única) ----------
create table if not exists beauty.configuracoes (
  id int primary key default 1 check (id = 1),
  nome_salao text not null default 'Espaço Beauty',
  responsavel text not null default 'Eliana Domingues',
  whatsapp text,
  instagram text,
  endereco text,
  sinal_percentual numeric(5,2) not null default 20 check (sinal_percentual between 0 and 100),
  hold_minutos int not null default 30 check (hold_minutos between 5 and 240),
  slot_min int not null default 10 check (slot_min in (5,10,15,20,30)),
  antecedencia_min_horas int not null default 2 check (antecedencia_min_horas >= 0),
  limite_cancelamento_horas int not null default 24 check (limite_cancelamento_horas >= 0),
  janela_dias int not null default 60 check (janela_dias between 7 and 365),
  updated_at timestamptz not null default now()
);
insert into beauty.configuracoes (id) values (1) on conflict do nothing;
create trigger trg_cfg_updated before update on beauty.configuracoes
  for each row execute function beauty.set_updated_at();

-- ---------- Profissionais ----------
create table if not exists beauty.profissionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  bio text,
  foto_url text,
  cor text not null default '#B76E79',
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- Horário de trabalho semanal por profissional (0 = domingo … 6 = sábado)
create table if not exists beauty.horarios_trabalho (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references beauty.profissionais(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  almoco_inicio time,
  almoco_fim time,
  unique (profissional_id, dia_semana),
  check (fim > inicio),
  check ((almoco_inicio is null) = (almoco_fim is null)),
  check (almoco_inicio is null or (almoco_fim > almoco_inicio and almoco_inicio >= inicio and almoco_fim <= fim))
);

-- ---------- Serviços ----------
create table if not exists beauty.servicos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  descricao text,
  descricao_longa text,
  foto_url text,
  passos text[] not null default '{}',
  preco_base numeric(10,2) not null default 0 check (preco_base >= 0),
  duracao_min int not null default 30 check (duracao_min >= 0),
  tem_tamanho boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_servicos_updated before update on beauty.servicos
  for each row execute function beauty.set_updated_at();

create table if not exists beauty.variacoes_servico (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references beauty.servicos(id) on delete cascade,
  tamanho text not null check (tamanho in ('curto','medio','longo')),
  preco numeric(10,2) not null check (preco >= 0),
  duracao_min int not null check (duracao_min > 0),
  unique (servico_id, tamanho)
);

-- Quais profissionais fazem cada serviço
create table if not exists beauty.servico_profissionais (
  servico_id uuid not null references beauty.servicos(id) on delete cascade,
  profissional_id uuid not null references beauty.profissionais(id) on delete cascade,
  primary key (servico_id, profissional_id)
);

-- ---------- Bloqueios de agenda ----------
-- profissional_id nulo = bloqueia todas as profissionais
create table if not exists beauty.bloqueios (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid references beauty.profissionais(id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time not null,
  motivo text,
  created_at timestamptz not null default now(),
  check (fim > inicio)
);
create index if not exists idx_bloqueios_data on beauty.bloqueios (data);

-- ---------- Clientes ----------
create table if not exists beauty.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,
  email text,
  created_at timestamptz not null default now()
);

-- ---------- Agendamentos ----------
create table if not exists beauty.agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references beauty.clientes(id),
  profissional_id uuid not null references beauty.profissionais(id),
  servico_id uuid not null references beauty.servicos(id),
  variacao_id uuid references beauty.variacoes_servico(id),
  data date not null,
  inicio time not null,
  fim time not null,
  duracao_total int not null check (duracao_total > 0),
  valor_total numeric(10,2) not null check (valor_total >= 0),
  valor_pago numeric(10,2) not null default 0 check (valor_pago >= 0),
  tipo_pagamento beauty.tipo_pagamento not null default 'sinal',
  pagamento_status beauty.pagamento_status not null default 'pendente',
  status beauty.agendamento_status not null default 'aguardando_pagamento',
  observacoes text,
  origem text not null default 'site' check (origem in ('site','equipe')),
  token_gerenciar text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  expira_em timestamptz,
  remarcado_de uuid references beauty.agendamentos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim > inicio),
  -- impede dupla reserva da mesma profissional no banco, mesmo sob concorrência
  constraint agendamentos_sem_conflito exclude using gist (
    profissional_id with =,
    tsrange((data + inicio), (data + fim)) with &&
  ) where (status in ('aguardando_pagamento','pendente','confirmado','concluido'))
);
create index if not exists idx_ag_data on beauty.agendamentos (data, profissional_id);
create index if not exists idx_ag_cliente on beauty.agendamentos (cliente_id);
create index if not exists idx_ag_status on beauty.agendamentos (status, expira_em);
create trigger trg_ag_updated before update on beauty.agendamentos
  for each row execute function beauty.set_updated_at();

-- ---------- Pagamentos (Mercado Pago PIX) ----------
create table if not exists beauty.pagamentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references beauty.agendamentos(id) on delete cascade,
  provedor text not null default 'mercadopago',
  provedor_id text unique,
  tipo beauty.tipo_pagamento not null,
  valor numeric(10,2) not null check (valor > 0),
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','recusado','expirado','cancelado','reembolsado')),
  pix_copia_cola text,
  pix_qr_base64 text,
  expira_em timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pag_ag on beauty.pagamentos (agendamento_id);
create trigger trg_pag_updated before update on beauty.pagamentos
  for each row execute function beauty.set_updated_at();

-- ---------- Notificações push ----------
create table if not exists beauty.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  agendamento_id uuid references beauty.agendamentos(id) on delete cascade,
  equipe_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((agendamento_id is not null) <> (equipe_user_id is not null))
);

create table if not exists beauty.notificacoes_log (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references beauty.agendamentos(id) on delete cascade,
  tipo text not null,
  ok boolean not null default true,
  detalhe text,
  enviado_em timestamptz not null default now(),
  unique (agendamento_id, tipo)
);

-- ---------- Equipe (quem pode entrar no painel) ----------
-- auth.users é compartilhado com outros projetos no Leonidas:
-- só entra no painel quem estiver NESTA tabela.
create table if not exists beauty.equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel beauty.papel_equipe not null default 'profissional',
  profissional_id uuid references beauty.profissionais(id) on delete set null,
  nome text,
  created_at timestamptz not null default now()
);

-- ---------- Segurança: RLS ligada, nenhuma policy pública ----------
alter table beauty.configuracoes        enable row level security;
alter table beauty.profissionais        enable row level security;
alter table beauty.horarios_trabalho    enable row level security;
alter table beauty.servicos             enable row level security;
alter table beauty.variacoes_servico    enable row level security;
alter table beauty.servico_profissionais enable row level security;
alter table beauty.bloqueios            enable row level security;
alter table beauty.clientes             enable row level security;
alter table beauty.agendamentos         enable row level security;
alter table beauty.pagamentos           enable row level security;
alter table beauty.push_subscriptions   enable row level security;
alter table beauty.notificacoes_log     enable row level security;
alter table beauty.equipe               enable row level security;

revoke all on schema beauty from public, anon, authenticated;
revoke all on all tables in schema beauty from public, anon, authenticated;
revoke all on all sequences in schema beauty from public, anon, authenticated;
revoke all on all functions in schema beauty from public, anon, authenticated;

grant usage on schema beauty to service_role;
grant all on all tables in schema beauty to service_role;
grant all on all sequences in schema beauty to service_role;
grant execute on all functions in schema beauty to service_role;
alter default privileges in schema beauty grant all on tables to service_role;
alter default privileges in schema beauty grant all on sequences to service_role;
alter default privileges in schema beauty grant execute on functions to service_role;

-- ---------- Storage: bucket público só de leitura ----------
insert into storage.buckets (id, name, public)
values ('beauty-servicos', 'beauty-servicos', true)
on conflict (id) do nothing;
-- (sem policies de escrita: uploads passam pelo servidor com service_role)

-- ---------- Ajustes posteriores (já aplicados no banco do Leonidas) ----------
alter table beauty.servicos add column if not exists categoria text not null default 'Outros';
alter table beauty.configuracoes add column if not exists chave_pix text;
alter table beauty.configuracoes add column if not exists pix_favorecido text;

-- Categorias dos 17 serviços iniciais
update beauty.servicos set categoria = 'Unhas' where slug in ('pe','mao','pe-e-mao','spa-dos-pes','plastica-dos-pes');
update beauty.servicos set categoria = 'Cabelo' where slug in ('corte-e-escova','corte','escova');
update beauty.servicos set categoria = 'Tratamentos e coloração' where slug in ('progressiva','cronograma-capilar','relaxamento','tintura-raiz-e-escova','tintura-completa-e-escova','botox','progressiva-organica');
update beauty.servicos set categoria = 'Sobrancelha e buço' where slug in ('sobrancelha','buco');

-- Expõe o schema na API (equivale a Settings > API > Exposed schemas)
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, beauty';
notify pgrst, 'reload config';

-- ---------- Primeiro acesso da administradora ----------
-- 1) Crie o usuário em Authentication > Users > Add user (marque "Auto Confirm User").
-- 2) Rode, trocando o e-mail:
-- insert into beauty.equipe (user_id, papel, nome)
-- select id, 'admin', 'Eliana Domingues' from auth.users where email = 'EMAIL-DA-ELIANA@exemplo.com'
-- on conflict (user_id) do update set papel = 'admin';
