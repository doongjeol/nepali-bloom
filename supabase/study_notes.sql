-- Study notes table for Nepali Bloom
-- 1) Create table
create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id text not null,
  title text,
  content text not null
);

create index if not exists study_notes_client_id_created_at_idx
  on public.study_notes (client_id, created_at desc);

-- 2) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_study_notes_set_updated_at on public.study_notes;
create trigger trg_study_notes_set_updated_at
before update on public.study_notes
for each row
execute function public.set_updated_at();

-- 3) RLS note
-- This app currently has no authentication. If you enable RLS, you must add Auth
-- (recommended) or use a custom JWT approach so that client_id can be enforced.
-- For a quick start, keep RLS disabled for this table:
--   alter table public.study_notes disable row level security;

