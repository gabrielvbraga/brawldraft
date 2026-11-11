-- BANCO DO BRAWLDRAFT. Cole tudo no SQL Editor do Supabase e clique em Run.

-- 1) Salas do draft em trio (qualquer visitante pode ler, criar e atualizar).
create table if not exists rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table rooms enable row level security;
create policy "ler salas" on rooms for select to anon, authenticated using (true);
create policy "criar salas" on rooms for insert to anon, authenticated with check (true);
create policy "atualizar salas" on rooms for update to anon, authenticated using (true) with check (true);

-- 2) Dados de cada conta: histórico de partidas e Brawlers marcados.
--    Cada pessoa só lê e grava a própria linha.
create table if not exists user_data (
  user_id uuid primary key references auth.users on delete cascade,
  history jsonb not null default '[]',
  owned jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table user_data enable row level security;
create policy "ler meus dados" on user_data for select to authenticated using (auth.uid() = user_id);
create policy "criar meus dados" on user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "atualizar meus dados" on user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Contas do coletor de partidas. Só o servidor (chave service_role) mexe aqui.
create table if not exists stats (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table stats enable row level security;
