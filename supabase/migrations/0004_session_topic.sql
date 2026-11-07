-- =============================================================================
-- Bizu Tracker — Tópico da sessão de estudo
--
-- Permite registrar, além da matéria, qual tópico (2º nível do edital
-- verticalizado) foi estudado na sessão.
-- =============================================================================

alter table public.study_sessions
  add column if not exists topic_id uuid
    references public.edital_subjects(id) on delete set null;

alter table public.study_sessions
  add column if not exists topic_name text;

create index if not exists idx_study_sessions_topic
  on public.study_sessions (topic_id, started_at desc);

comment on column public.study_sessions.topic_id is
  'Tópico do edital verticalizado estudado nesta sessão (opcional).';
comment on column public.study_sessions.topic_name is
  'Nome do tópico no momento da sessão (preservado se o tópico for excluído).';
