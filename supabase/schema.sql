-- Moda Center Capital Program Planner — Supabase schema + RLS.
-- Run once in the Supabase SQL Editor (project gwibvygyjrmtnywgsknq).
-- Idempotent-ish: rerunning after a partial failure is safe if you drop the
-- created objects first; tables use IF NOT EXISTS where it matters.

-- ════════════════════════════════════════════════════════════════════════
-- 0. Shared updated_at trigger
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. line_items — the 65-item cost catalog, flat.
--    base is authoritative (NOT always qty*unit — OVERLAY lump sums).
--    status/phase/funding_class/alloc are the canonical seeded defaults,
--    computed once by the seed script; per-user departures live in scenario
--    snapshots / user_state.funding_overrides, never here.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.line_items (
  id            text primary key,           -- 'L100-01' … 'AG-01'
  level_id      text not null check (level_id in
                  ('L100','L200','L300','L400','L500','L700','OVERLAY','AGING')),
  level_name    text not null,
  level_order   smallint not null,          -- source array order (levels)
  item_order    smallint not null,          -- order within level
  name          text not null,
  qty           numeric not null,
  unit          numeric,                    -- null where source cell obscured
  base          bigint not null check (base >= 0),
  derived       boolean not null default false,
  trade         text not null,
  status        text not null check (status in ('required','value-add')),
  phase         text not null check (phase in ('1OS','1DS','2OS','2DS','3OS','3DS','CONT')),
  funding_class text not null check (funding_class in ('systems','premium','general')),
  alloc_2027    smallint not null check (alloc_2027 between 0 and 100),
  alloc_2028    smallint not null check (alloc_2028 between 0 and 100),
  alloc_2029    smallint not null check (alloc_2029 between 0 and 100),
  constraint line_items_alloc_100 check (alloc_2027 + alloc_2028 + alloc_2029 = 100),
  constraint line_items_level_pos unique (level_id, item_order)
);

-- ════════════════════════════════════════════════════════════════════════
-- 2. app_constants — key/jsonb store for every constant leaving the repo:
--    'meta', 'guardrail_capacity', 'season_windows', 'escalation_default_rates',
--    'public_funding_caps', 'startup_audit_band', 'sequence_captions'.
--    Seeded by the seed script.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.app_constants (
  key         text primary key,
  value       jsonb not null,
  description text
);

-- ════════════════════════════════════════════════════════════════════════
-- 3. scenarios — saved scenarios + one reserved "working" row per user.
--    Client-generated text ids; reserved id 'working'. Composite PK gives
--    per-user uniqueness and trivial working-row upsert (no partial index).
--    snapshot mirrors ScenarioSnapshot: {itemState: {<id>: {phase, included,
--    alloc}}, rates}. Baseline is NEVER stored (client constant).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.scenarios (
  id         text not null,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null default '',
  snapshot   jsonb not null check (snapshot ? 'itemState' and snapshot ? 'rates'),
  version    integer not null default 1,    -- CAS counter for the working row
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists scenarios_owner_idx on public.scenarios (owner, updated_at desc);

drop trigger if exists scenarios_set_updated_at on public.scenarios;
create trigger scenarios_set_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();

-- Server-side MAX_USER_SCENARIOS = 6 backstop (client enforces it too).
create or replace function public.check_scenario_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id <> 'working' and (
    select count(*) from public.scenarios
    where owner = new.owner and id <> 'working') >= 6 then
    raise exception 'scenario limit (6) reached';
  end if;
  return new;
end;
$$;
drop trigger if exists scenarios_limit on public.scenarios;
create trigger scenarios_limit
  before insert on public.scenarios
  for each row execute function public.check_scenario_limit();

-- ════════════════════════════════════════════════════════════════════════
-- 4. user_state — one row per user: global assumptions + active/compare
--    pointers (PersistedState minus scenarios/working).
--    'baseline' is a client-side sentinel, never a scenarios row — hence
--    text pointers, no FK; the client sanitizes unresolvable ids.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.user_state (
  owner               uuid primary key default auth.uid()
                        references auth.users(id) on delete cascade,
  active_scenario_id  text not null default 'baseline',
  compare_scenario_id text,
  funding_overrides   jsonb not null default '{}'::jsonb,
  labor_fractions     jsonb not null default '{}'::jsonb, -- {} => client defaults apply
  labor_globals       jsonb not null default '{}'::jsonb,
  participation       jsonb not null default '{}'::jsonb,
  import_resolved     boolean not null default false,     -- one-time localStorage import flag
  version             integer not null default 1,
  updated_at          timestamptz not null default now()
);
drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at
  before update on public.user_state
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 5. RLS — enable + default-deny everywhere.
-- ════════════════════════════════════════════════════════════════════════
alter table public.line_items    enable row level security;
alter table public.app_constants enable row level security;
alter table public.scenarios     enable row level security;
alter table public.user_state    enable row level security;

-- Reference tables: SELECT for authenticated only.
-- NO insert/update/delete policies exist => clients can never write them.
create policy "authenticated read" on public.line_items
  for select to authenticated using (true);
create policy "authenticated read" on public.app_constants
  for select to authenticated using (true);

-- scenarios: full CRUD, owner-scoped. (select auth.uid()) is cached per
-- statement rather than re-evaluated per row.
create policy "own select" on public.scenarios
  for select to authenticated using ((select auth.uid()) = owner);
create policy "own insert" on public.scenarios
  for insert to authenticated with check ((select auth.uid()) = owner);
create policy "own update" on public.scenarios
  for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);
create policy "own delete" on public.scenarios
  for delete to authenticated using ((select auth.uid()) = owner);

-- user_state: same owner-scoped CRUD.
create policy "own select" on public.user_state
  for select to authenticated using ((select auth.uid()) = owner);
create policy "own insert" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = owner);
create policy "own update" on public.user_state
  for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);
create policy "own delete" on public.user_state
  for delete to authenticated using ((select auth.uid()) = owner);

-- Belt-and-suspenders: fail anon at the privilege layer (401/permission
-- denied) instead of returning empty rows, and strip client write grants on
-- reference tables entirely. service_role has BYPASSRLS and keeps its grants
-- — the seed script is unaffected.
revoke all on public.line_items, public.app_constants,
              public.scenarios, public.user_state from anon;
revoke insert, update, delete on public.line_items, public.app_constants
  from authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Post-run spot checks (run after seeding)
-- ════════════════════════════════════════════════════════════════════════
-- select count(*), sum(base) from public.line_items;   -- expect 65 | 347452128
-- select key from public.app_constants order by key;   -- expect 7 keys
-- select rolname, rolbypassrls from pg_roles where rolname = 'service_role';  -- t
-- select tablename, policyname, roles from pg_policies where schemaname = 'public';

-- Also in the Dashboard: Authentication → Sign In / Up →
--   disable "Allow new users to sign up" (invitation-only).
