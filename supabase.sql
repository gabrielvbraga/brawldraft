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

-- 9) PROTEÇÕES EXTRAS (contra abuso e spam)
-- Placar: no máximo uma nota por conta a cada 60 segundos.
create or replace function public.limitar_notas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from train_scores
    where user_id = new.user_id and created_at > now() - interval '60 seconds'
  ) then
    raise exception 'calma: uma nota por minuto';
  end if;
  return new;
end;
$$;
drop trigger if exists limitar_notas on train_scores;
create trigger limitar_notas before insert on train_scores for each row execute function public.limitar_notas();

-- Tamanhos máximos: apelido, nome de tela e o estado de uma sala.
do $$ begin
  alter table train_scores add constraint nick_curto check (char_length(nick) between 2 and 20) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table visits add constraint tela_curta check (char_length(screen) <= 30) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table rooms add constraint sala_pequena check (pg_column_size(state) < 4000 and char_length(code) <= 8) not valid;
exception when duplicate_object then null; end $$;

-- 10) AS SUGESTÕES FUNCIONAM? (v11)
-- Cada resultado salvo no fim de um draft (só de quem tem conta) guarda se a pessoa
-- seguiu uma das 3 primeiras sugestões e se venceu. Ninguém lê as linhas: o site só
-- vê o resumo (função rec_summary).
create table if not exists rec_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  followed boolean not null,
  win boolean not null,
  map text not null check (char_length(map) <= 40),
  brawler text not null check (char_length(brawler) <= 30),
  created_at timestamptz not null default now()
);
alter table rec_results enable row level security;
drop policy if exists "gravar meu resultado" on rec_results;
create policy "gravar meu resultado" on rec_results for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.limitar_resultados() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from rec_results
    where user_id = new.user_id and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'calma: um resultado a cada 30 segundos';
  end if;
  return new;
end;
$$;
drop trigger if exists limitar_resultados on rec_results;
create trigger limitar_resultados before insert on rec_results for each row execute function public.limitar_resultados();

create or replace function public.rec_summary()
returns table (followed boolean, games bigint, wins bigint)
language sql stable security definer set search_path = public as $$
  select followed, count(*), count(*) filter (where win) from rec_results group by followed;
$$;
grant execute on function public.rec_summary() to anon, authenticated;

-- 11) AVISOS NO CELULAR (v11)
-- Cada aparelho que ligou os avisos. Só o servidor (chave secreta) lê e grava aqui.
create table if not exists push_subs (
  endpoint text primary key check (char_length(endpoint) < 700),
  maps integer[] not null default '{}',
  lang text not null default 'pt',
  message jsonb,
  notified jsonb not null default '{}'::jsonb,
  meta_day text,
  created_at timestamptz not null default now()
);
alter table push_subs enable row level security;

-- 12) VISUALIZAÇÕES DE PERFIL (v13)
-- Cada pessoa que abre um perfil conta 1 vez por dia. "viewer" é um código embaralhado
-- (não dá para descobrir quem é). Só o servidor lê e grava aqui.
create table if not exists profile_views (
  tag text not null check (char_length(tag) <= 15),
  viewer text not null check (char_length(viewer) <= 40),
  day date not null default current_date,
  primary key (tag, viewer, day)
);
alter table profile_views enable row level security;

-- 13) MAIOR RANK E CONQUISTAS (v14)
-- Maior rank do Ranked que o site já viu para cada tag (a API só mostra o rank atual).
create table if not exists rank_best (
  tag text primary key check (char_length(tag) <= 15),
  best integer not null check (best between 0 and 21),
  updated_at timestamptz not null default now()
);
alter table rank_best enable row level security;

-- Guarda o rank e devolve o maior já visto. Só o servidor chama.
create or replace function public.note_rank(p_tag text, p_rank integer) returns integer
language sql security definer set search_path = public as $$
  insert into rank_best (tag, best) values (p_tag, p_rank)
  on conflict (tag) do update set best = greatest(rank_best.best, excluded.best), updated_at = now()
  returning best;
$$;
revoke execute on function public.note_rank(text, integer) from public, anon, authenticated;

-- Números do uso do site (drafts feitos, Brawler do dia, duelos) para as conquistas.
alter table user_data add column if not exists stats jsonb not null default '{}'::jsonb;
alter table user_data drop constraint if exists stats_tamanho;
alter table user_data add constraint stats_tamanho check (pg_column_size(stats) < 2000) not valid;
