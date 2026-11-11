-- =============================================================================
-- Bizu Tracker — Tópico do bloco de ciclo
--
-- O ciclo passa a planejar no nível do tópico (2º nível do edital), e não
-- apenas da disciplina. O nome é preservado como snapshot, no mesmo padrão de
-- `study_sessions.topic_name`: se o edital mudar, o bloco continua legível.
-- =============================================================================

alter table public.cycle_blocks
  add column if not exists topic_id uuid
    references public.edital_subjects(id) on delete set null;

alter table public.cycle_blocks
  add column if not exists topic_name text;

create index if not exists idx_cycle_blocks_topic
  on public.cycle_blocks (topic_id);

comment on column public.cycle_blocks.topic_id is
  'Tópico do edital verticalizado planejado neste bloco (opcional).';

comment on column public.cycle_blocks.topic_name is
  'Nome do tópico no momento em que o ciclo foi montado (snapshot).';
