-- =============================================================================
-- Bizu Tracker — Migration inicial
-- Tabelas, enums, RLS e índices.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profile (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  weekly_goal_min int not null default 1200,   -- minutos/semana
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria automaticamente o profile quando um usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.area_type as enum ('CONCURSO', 'VESTIBULAR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.edital_status as enum ('DRAFT', 'ACTIVE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.importance as enum ('CAI_POUCO', 'CAI_MEDIO', 'CAI_MUITO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.progress_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'REVISED', 'DONE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum ('THEORY', 'QUESTIONS', 'REVIEW', 'SIMULATED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.level as enum ('EASY', 'MEDIUM', 'HARD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.result as enum ('CORRECT', 'WRONG', 'SKIPPED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entity_type as enum ('CYCLE', 'EDITAL');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 3. Área de estudo (concurso/vestibular alvo)
-- -----------------------------------------------------------------------------
create table if not exists public.study_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_type public.area_type not null default 'CONCURSO',
  exam_board text,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. Edital verticalizado
-- -----------------------------------------------------------------------------
create table if not exists public.editals (
  id uuid primary key default gen_random_uuid(),
  study_area_id uuid not null references public.study_areas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_pdf_path text,                       -- path no Storage
  raw_text text,                              -- texto extraído (reprocessar)
  status public.edital_status not null default 'DRAFT',
  is_public boolean not null default false,
  extraction_status text not null default 'NONE',  -- NONE | RUNNING | DONE | FAILED
  extraction_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edital_subjects (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.editals(id) on delete cascade,
  parent_id uuid references public.edital_subjects(id) on delete cascade,
  name text not null,
  weight numeric,                             -- 0–1, priorização
  importance public.importance not null default 'CAI_MEDIO',
  sort_order int not null default 0,
  progress_studied numeric not null default 0, -- 0–100
  status public.progress_status not null default 'NOT_STARTED'
);

-- -----------------------------------------------------------------------------
-- 5. Ciclos de estudo
-- -----------------------------------------------------------------------------
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  study_area_id uuid not null references public.study_areas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  period_days int not null default 7,
  is_public boolean not null default false,
  source_cycle_id uuid references public.cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cycle_blocks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  activity public.activity_type not null default 'THEORY',
  minutes int not null default 0,
  day_of_cycle int not null default 0,        -- 0..period_days-1
  sort_order int not null default 0
);

-- -----------------------------------------------------------------------------
-- 6. Sessões de estudo (timer)
-- -----------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_area_id uuid references public.study_areas(id) on delete set null,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  activity public.activity_type not null default 'THEORY',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec int not null default 0          -- segundos efetivos (exclui pausas)
);

-- -----------------------------------------------------------------------------
-- 7. Questões resolvidas
-- -----------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_area_id uuid references public.study_areas(id) on delete set null,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  exam_board text,
  level public.level not null default 'MEDIUM',
  result public.result not null default 'CORRECT',
  took_sec int,
  answered_at timestamptz not null default now(),
  notes text
);

-- -----------------------------------------------------------------------------
-- 8. Links de compartilhamento
-- -----------------------------------------------------------------------------
create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (entity_type, entity_id)
);

-- -----------------------------------------------------------------------------
-- 9. Índices
-- -----------------------------------------------------------------------------
create index if not exists idx_study_areas_user on public.study_areas (user_id);
create index if not exists idx_editals_area on public.editals (study_area_id);
create index if not exists idx_edital_subjects_edital on public.edital_subjects (edital_id);
create index if not exists idx_edital_subjects_parent on public.edital_subjects (parent_id);
create index if not exists idx_cycles_area on public.cycles (study_area_id);
create index if not exists idx_cycles_user on public.cycles (user_id);
create index if not exists idx_cycle_blocks_cycle on public.cycle_blocks (cycle_id);
create index if not exists idx_study_sessions_user_started on public.study_sessions (user_id, started_at desc);
create index if not exists idx_study_sessions_area on public.study_sessions (study_area_id, started_at desc);
create index if not exists idx_questions_user_answered on public.questions (user_id, answered_at desc);
create index if not exists idx_questions_subject_answered on public.questions (subject_id, answered_at desc);
create index if not exists idx_shared_links_slug on public.shared_links (slug);

-- -----------------------------------------------------------------------------
-- 10. updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_study_areas on public.study_areas;
create trigger touch_study_areas before update on public.study_areas
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_editals on public.editals;
create trigger touch_editals before update on public.editals
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_cycles on public.cycles;
create trigger touch_cycles before update on public.cycles
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- 11. Row Level Security
-- =============================================================================
alter table public.profiles         enable row level security;
alter table public.study_areas      enable row level security;
alter table public.editals          enable row level security;
alter table public.edital_subjects  enable row level security;
alter table public.cycles           enable row level security;
alter table public.cycle_blocks     enable row level security;
alter table public.study_sessions   enable row level security;
alter table public.questions        enable row level security;
alter table public.shared_links     enable row level security;

-- ---- profiles ----
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---- study_areas ----
drop policy if exists "areas: own all" on public.study_areas;
create policy "areas: own all"
  on public.study_areas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- editals ----
drop policy if exists "editals: own all" on public.editals;
create policy "editals: own all"
  on public.editals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "editals: public read" on public.editals;
create policy "editals: public read"
  on public.editals for select
  using (is_public = true);

-- ---- edital_subjects (dono via edital) ----
drop policy if exists "subjects: own all" on public.edital_subjects;
create policy "subjects: own all"
  on public.edital_subjects for all
  using (
    exists (
      select 1 from public.editals e
      where e.id = edital_subjects.edital_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.editals e
      where e.id = edital_subjects.edital_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "subjects: public read" on public.edital_subjects;
create policy "subjects: public read"
  on public.edital_subjects for select
  using (
    exists (
      select 1 from public.editals e
      where e.id = edital_subjects.edital_id and e.is_public = true
    )
  );

-- ---- cycles ----
drop policy if exists "cycles: own all" on public.cycles;
create policy "cycles: own all"
  on public.cycles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cycles: public read" on public.cycles;
create policy "cycles: public read"
  on public.cycles for select
  using (is_public = true);

-- ---- cycle_blocks (dono via cycle) ----
drop policy if exists "blocks: own all" on public.cycle_blocks;
create policy "blocks: own all"
  on public.cycle_blocks for all
  using (
    exists (
      select 1 from public.cycles c
      where c.id = cycle_blocks.cycle_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cycles c
      where c.id = cycle_blocks.cycle_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "blocks: public read" on public.cycle_blocks;
create policy "blocks: public read"
  on public.cycle_blocks for select
  using (
    exists (
      select 1 from public.cycles c
      where c.id = cycle_blocks.cycle_id and c.is_public = true
    )
  );

-- ---- study_sessions ----
drop policy if exists "sessions: own all" on public.study_sessions;
create policy "sessions: own all"
  on public.study_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- questions ----
drop policy if exists "questions: own all" on public.questions;
create policy "questions: own all"
  on public.questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- shared_links ----
drop policy if exists "links: own all" on public.shared_links;
create policy "links: own all"
  on public.shared_links for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "links: public read" on public.shared_links;
create policy "links: public read"
  on public.shared_links for select
  using (true);
