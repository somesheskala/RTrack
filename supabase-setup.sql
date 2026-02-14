create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow shared state read" on public.app_state;
drop policy if exists "Allow shared state write" on public.app_state;

create policy "Allow shared state read"
on public.app_state
for select
to anon, authenticated
using (true);

create policy "Allow shared state write"
on public.app_state
for insert
to anon, authenticated
with check (true);

create policy "Allow shared state update"
on public.app_state
for update
to anon, authenticated
using (true)
with check (true);
