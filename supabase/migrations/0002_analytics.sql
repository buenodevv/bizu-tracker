-- =============================================================================
-- Bizu Tracker — Funções de analytics (RPC)
-- Agregações executadas no banco (mais rápido, menos tráfego).
-- Todas usam SECURITY INVOKER: o RLS do usuário continua valendo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Horas por matéria num período (minutos)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_hours_by_subject(
  _from timestamptz,
  _to timestamptz
)
returns table (subject_name text, minutes numeric, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.subject_name,
    sum(s.duration_sec)::numeric / 60 as minutes,
    count(*) as sessions
  from public.study_sessions s
  where s.user_id = auth.uid()
    and s.started_at >= _from
    and s.started_at < _to
  group by s.subject_name
  order by minutes desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Horas por dia num período (para gráfico de linha/barras)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_hours_by_day(
  _from timestamptz,
  _to timestamptz
)
returns table (day date, minutes numeric, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (s.started_at at time zone 'America/Sao_Paulo')::date as day,
    sum(s.duration_sec)::numeric / 60 as minutes,
    count(*) as sessions
  from public.study_sessions s
  where s.user_id = auth.uid()
    and s.started_at >= _from
    and s.started_at < _to
  group by 1
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Horas por matéria E dia (matriz para stacked bars)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_hours_by_subject_day(
  _from timestamptz,
  _to timestamptz
)
returns table (day date, subject_name text, minutes numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (s.started_at at time zone 'America/Sao_Paulo')::date as day,
    s.subject_name,
    sum(s.duration_sec)::numeric / 60 as minutes
  from public.study_sessions s
  where s.user_id = auth.uid()
    and s.started_at >= _from
    and s.started_at < _to
  group by 1, 2
  order by 1, 3 desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. Acurácia em questões por matéria
-- ---------------------------------------------------------------------------
create or replace function public.analytics_accuracy_by_subject(
  _from timestamptz,
  _to timestamptz
)
returns table (
  subject_name text,
  total bigint,
  correct bigint,
  wrong bigint,
  accuracy numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    q.subject_name,
    count(*) filter (where q.result <> 'SKIPPED') as total,
    count(*) filter (where q.result = 'CORRECT') as correct,
    count(*) filter (where q.result = 'WRONG') as wrong,
    case
      when count(*) filter (where q.result <> 'SKIPPED') = 0 then 0
      else round(
        100.0 * count(*) filter (where q.result = 'CORRECT')
          / count(*) filter (where q.result <> 'SKIPPED'),
        1
      )
    end as accuracy
  from public.questions q
  where q.user_id = auth.uid()
    and q.answered_at >= _from
    and q.answered_at < _to
  group by q.subject_name
  having count(*) filter (where q.result <> 'SKIPPED') > 0
  order by accuracy asc;
$$;

-- ---------------------------------------------------------------------------
-- 5. Totais do período (cards do dashboard/analytics)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_totals(
  _from timestamptz,
  _to timestamptz
)
returns table (
  total_minutes numeric,
  total_sessions bigint,
  questions_total bigint,
  questions_correct bigint,
  accuracy numeric,
  active_days bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select * from public.study_sessions
    where user_id = auth.uid()
      and started_at >= _from and started_at < _to
  ),
  q as (
    select * from public.questions
    where user_id = auth.uid()
      and answered_at >= _from and answered_at < _to
  )
  select
    coalesce((select sum(duration_sec)::numeric / 60 from s), 0) as total_minutes,
    (select count(*) from s) as total_sessions,
    (select count(*) from q where result <> 'SKIPPED') as questions_total,
    (select count(*) from q where result = 'CORRECT') as questions_correct,
    coalesce(
      (select round(100.0 * count(*) filter (where result = 'CORRECT')
               / nullif(count(*) filter (where result <> 'SKIPPED'), 0), 1)
       from q),
      0
    ) as accuracy,
    (select count(distinct (started_at at time zone 'America/Sao_Paulo')::date)
     from s) as active_days;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
grant execute on function public.analytics_hours_by_subject(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_hours_by_day(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_hours_by_subject_day(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_accuracy_by_subject(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_totals(timestamptz, timestamptz) to authenticated;
