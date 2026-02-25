-- AI analysis results persistence with staleness detection.
-- Run in Supabase SQL Editor or via Supabase CLI.

create table if not exists public.ai_results (
  account_id text primary key,
  result jsonb not null,
  data_hash text not null,
  analyzed_at timestamptz not null default now(),
  analyzed_by text
);

comment on table public.ai_results is 'Persisted AI analysis per account; data_hash used to detect stale when account data changes.';

create index if not exists idx_ai_results_analyzed_at on public.ai_results (analyzed_at desc);

alter table public.ai_results enable row level security;

do $$
begin
  drop policy if exists "Allow all access ai_results" on public.ai_results;
  create policy "Allow all access ai_results"
    on public.ai_results for all
    using (true) with check (true);
end $$;
