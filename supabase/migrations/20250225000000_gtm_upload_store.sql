-- GTM Intelligence Engine: persist uploaded CSV data (8 tables as JSONB).
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) or via Supabase CLI.

create table if not exists public.gtm_upload_store (
  table_key text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.gtm_upload_store is 'One row per dashboard table (productCatalog, accounts, locations, etc.). data = array of CSV row objects.';

alter table public.gtm_upload_store enable row level security;

-- Allow anonymous read/write so the app (using anon key) can load and save.
-- Restrict later with auth if you add Supabase Auth.
-- Run as one block so drops always run before creates (safe to re-run).
do $$
begin
  drop policy if exists "Allow anon read gtm_upload_store" on public.gtm_upload_store;
  drop policy if exists "Allow anon insert gtm_upload_store" on public.gtm_upload_store;
  drop policy if exists "Allow anon update gtm_upload_store" on public.gtm_upload_store;

  create policy "Allow anon read gtm_upload_store"
    on public.gtm_upload_store for select
    to anon using (true);

  create policy "Allow anon insert gtm_upload_store"
    on public.gtm_upload_store for insert
    to anon with check (true);

  create policy "Allow anon update gtm_upload_store"
    on public.gtm_upload_store for update
    to anon using (true) with check (true);
end $$;
