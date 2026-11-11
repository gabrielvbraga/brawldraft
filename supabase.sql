-- Tabela das salas de draft em trio. Cole tudo no SQL Editor do Supabase e clique em Run.
create table if not exists rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Libera ler, criar e atualizar salas para qualquer visitante do site
-- (as salas só guardam o draft, nada pessoal).
alter table rooms enable row level security;
create policy "ler salas" on rooms for select to anon using (true);
create policy "criar salas" on rooms for insert to anon with check (true);
create policy "atualizar salas" on rooms for update to anon using (true) with check (true);
