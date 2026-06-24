-- ============================================================================
-- Polla "Mundial Condominio" — Supabase schema
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run
-- ============================================================================

-- Predictions: one row per family member.
create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  home_goals  int  not null check (home_goals >= 0 and home_goals <= 30),
  away_goals  int  not null check (away_goals >= 0 and away_goals <= 30),
  created_at  timestamptz not null default now()
);

-- One prediction per person (case-insensitive name).
create unique index if not exists predictions_name_unique
  on public.predictions (lower(name));

-- Match state: a single row (id = 1) holding the match config + final result.
create table if not exists public.match_state (
  id          int  primary key default 1,
  home_team   text not null,
  away_team   text not null,
  kickoff     timestamptz,            -- predictions lock at this moment; null = open
  final_home  int,                    -- null until the match is over
  final_away  int,
  updated_at  timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- Seed the match. EDIT the kickoff time below to the real local kickoff
-- (stored in UTC). Example: Colombia kicks off 2026-06-23 20:00 Colombia time
-- (UTC-5) = 2026-06-24 01:00 UTC.
insert into public.match_state (id, home_team, away_team, kickoff)
values (1, 'Colombia', 'RD Congo', '2026-06-24T01:00:00Z')
on conflict (id) do nothing;

-- Row Level Security: lock the tables down completely. The app reaches these
-- tables ONLY through server routes using the service-role key, which bypasses
-- RLS. With no policies + RLS on, the public anon key can read/write nothing,
-- so nobody can peek at predictions directly from the browser.
alter table public.predictions enable row level security;
alter table public.match_state enable row level security;
