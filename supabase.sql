-- BANCO DO BRAWLDRAFT. Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem problema: o que já existe é mantido, e só o que falta é criado.

-- 1) Salas do draft em trio (qualquer visitante pode ler, criar e atualizar).
create table if not exists rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table rooms enable row level security;
drop policy if exists "ler salas" on rooms;
drop policy if exists "criar salas" on rooms;
drop policy if exists "atualizar salas" on rooms;
create policy "ler salas" on rooms for select to anon, authenticated using (true);
create policy "criar salas" on rooms for insert to anon, authenticated with check (true);
create policy "atualizar salas" on rooms for update to anon, authenticated using (true) with check (true);

-- 2) Dados de cada conta. Cada pessoa só lê e grava a própria linha.
create table if not exists user_data (
  user_id uuid primary key references auth.users on delete cascade,
  history jsonb not null default '[]',
  owned jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table user_data add column if not exists nick text;
alter table user_data add column if not exists tag text;
alter table user_data add column if not exists roster jsonb not null default '[]';
alter table user_data add column if not exists free6 jsonb not null default '[]';
alter table user_data enable row level security;
drop policy if exists "ler meus dados" on user_data;
drop policy if exists "criar meus dados" on user_data;
drop policy if exists "atualizar meus dados" on user_data;
create policy "ler meus dados" on user_data for select to authenticated using (auth.uid() = user_id);
create policy "criar meus dados" on user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "atualizar meus dados" on user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Contas do coletor de partidas. Só o servidor (chave secreta) mexe aqui.
create table if not exists stats (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table stats enable row level security;

-- 4) Cópia diária do meta do topbrawl (para "quem subiu e quem caiu"). Só o servidor mexe.
create table if not exists meta_history (
  day date primary key,
  overall jsonb not null
);
alter table meta_history enable row level security;

-- 5) Administradores do site.
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table admins enable row level security;
drop policy if exists "ver se sou admin" on admins;
create policy "ver se sou admin" on admins for select to authenticated using (auth.uid() = user_id);

-- Função usada nas regras abaixo: a pessoa logada é administradora?
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- 6) Correções do administrador (counters, sinergias e dicas de mapa). Todos leem, só o admin grava.
create table if not exists overrides (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table overrides enable row level security;
drop policy if exists "ler correcoes" on overrides;
drop policy if exists "admin cria correcoes" on overrides;
drop policy if exists "admin muda correcoes" on overrides;
create policy "ler correcoes" on overrides for select to anon, authenticated using (true);
create policy "admin cria correcoes" on overrides for insert to authenticated with check (public.is_admin());
create policy "admin muda correcoes" on overrides for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 7) Contador de visitas: qualquer visitante registra, só o admin lê.
create table if not exists visits (
  id bigint generated always as identity primary key,
  screen text not null,
  day date not null default current_date,
  created_at timestamptz not null default now()
);
alter table visits enable row level security;
drop policy if exists "registrar visita" on visits;
drop policy if exists "admin le visitas" on visits;
create policy "registrar visita" on visits for insert to anon, authenticated with check (true);
create policy "admin le visitas" on visits for select to authenticated using (public.is_admin());

-- 8) Placar do treino: só contas logadas gravam (a própria nota); todos leem.
create table if not exists train_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  nick text not null,
  score integer not null check (score between 0 and 100),
  map text not null,
  created_at timestamptz not null default now()
);
alter table train_scores enable row level security;
drop policy if exists "ler placar" on train_scores;
drop policy if exists "gravar minha nota" on train_scores;
create policy "ler placar" on train_scores for select to anon, authenticated using (true);
create policy "gravar minha nota" on train_scores for insert to authenticated with check (auth.uid() = user_id);
