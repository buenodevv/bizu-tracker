-- =============================================================================
-- Bizu Tracker — Analytics por tópico
--
-- Agrega tempo de estudo e questões por tópico do edital verticalizado,
-- permitindo ver onde o tempo foi investido dentro de cada disciplina.
-- Todas usam SECURITY INVOKER: o RLS do usuário continua valendo.
-- =============================================================================

-- Questões também podem ser vinculadas a um tópico.
alter table public.questions
  add column if not exists topic_id uuid
    references public.edital_subjects(id) on delete set null;

alter table public.questions
  add column if not exists topic_name text;

create index if not exists idx_questions_topic
  on public.questions (topic_id, answered_at desc);

-- ---------------------------------------------------------------------------
-- 1. Tempo estudado por tópico (com a disciplina pai)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_hours_by_topic(
  _from timestamptz,
  _to timestamptz
)
returns table (
  topic_id uuid,
  topic_name text,
  subject_name text,
  minutes numeric,
  sessions bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.topic_id,
    coalesce(s.topic_name, parent.name) as topic_name,
    coalesce(parent.name, s.subject_name) as subject_name,
    sum(s.duration_sec)::numeric / 60 as minutes,
    count(*) as sessions
  from public.study_sessions s
  left join public.edital_subjects topic on topic.id = s.topic_id
  left join public.edital_subjects parent on parent.id = topic.parent_id
  where s.user_id = auth.uid()
    and s.topic_id is not null
    and s.started_at >= _from
    and s.started_at < _to
  group by 1, 2, 3
  order by minutes desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Acurácia por tópico (questões com subject_id de tópico)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_accuracy_by_topic(
  _from timestamptz,
  _to timestamptz
)
returns table (
  topic_id uuid,
  topic_name text,
  subject_name text,
  total bigint,
  correct bigint,
  accuracy numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    q.topic_id,
    coalesce(q.topic_name, topic.name) as topic_name,
    coalesce(parent.name, q.subject_name) as subject_name,
    count(*) filter (where q.result <> 'SKIPPED') as total,
    count(*) filter (where q.result = 'CORRECT') as correct,
    case
      when count(*) filter (where q.result <> 'SKIPPED') = 0 then 0
      else round(
        100.0 * count(*) filter (where q.result = 'CORRECT')
          / count(*) filter (where q.result <> 'SKIPPED'),
        1
      )
    end as accuracy
  from public.questions q
  left join public.edital_subjects topic on topic.id = q.topic_id
  left join public.edital_subjects parent on parent.id = topic.parent_id
  where q.user_id = auth.uid()
    and q.topic_id is not null
    and q.answered_at >= _from
    and q.answered_at < _to
  group by 1, 2, 3
  having count(*) filter (where q.result <> 'SKIPPED') > 0
  order by accuracy asc;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cobertura do edital: quanto de cada disciplina já foi estudado
-- ---------------------------------------------------------------------------
create or replace function public.analytics_edital_coverage()
returns table (
  subject_id uuid,
  subject_name text,
  total_topics bigint,
  started_topics bigint,
  done_topics bigint,
  coverage_pct numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with roots as (
    select s.id, s.name
    from public.edital_subjects s
    join public.editals e on e.id = s.edital_id
    where e.user_id = auth.uid()
      and s.parent_id is null
  ),
  topics as (
    select t.parent_id as subject_id, t.progress_studied, t.status
    from public.edital_subjects t
    join public.editals e on e.id = t.edital_id
    where e.user_id = auth.uid()
      and t.parent_id is not null
  )
  select
    r.id as subject_id,
    r.name as subject_name,
    count(t.subject_id) as total_topics,
    count(t.subject_id) filter (where t.progress_studied > 0) as started_topics,
    count(t.subject_id) filter (where t.status = 'DONE') as done_topics,
    case
      when count(t.subject_id) = 0 then 0
      else round(
        100.0 * count(t.subject_id) filter (where t.status = 'DONE')
          / count(t.subject_id),
        1
      )
    end as coverage_pct
  from roots r
  left join topics t on t.subject_id = r.id
  group by r.id, r.name
  having count(t.subject_id) > 0
  order by coverage_pct desc;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
grant execute on function public.analytics_hours_by_topic(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_accuracy_by_topic(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_edital_coverage() to authenticated;
