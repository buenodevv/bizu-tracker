-- =============================================================================
-- Bizu Tracker — Progresso automático do tópico ao estudar
--
-- Quando uma sessão é salva com `topic_id`, o progresso do tópico avança com
-- base no tempo acumulado de estudo naquele assunto.
--
-- Regra: cada 30 minutos acumulados = +25% de progresso.
--   - 30 min  -> 25%   (IN_PROGRESS)
--   - 60 min  -> 50%   (IN_PROGRESS)
--   - 90 min  -> 75%   (IN_PROGRESS)
--   - 120 min -> 100%  (DONE)
-- O progresso nunca regride e nunca passa de 100.
-- =============================================================================

create or replace function public.sync_topic_progress(_topic_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  total_min numeric;
  new_progress numeric;
  new_status public.progress_status;
begin
  if _topic_id is null then
    return;
  end if;

  -- Tempo total já estudado neste tópico pelo usuário atual.
  select coalesce(sum(duration_sec), 0) / 60.0
    into total_min
    from public.study_sessions
   where user_id = auth.uid()
     and topic_id = _topic_id;

  -- 30 min = 25%. Limita a 100%.
  new_progress := least(100, round(total_min / 120.0 * 100));

  -- Nunca regride o progresso manual já registrado.
  select greatest(progress_studied, new_progress)
    into new_progress
    from public.edital_subjects
   where id = _topic_id;

  new_status := case
    when new_progress >= 100 then 'DONE'::public.progress_status
    when new_progress > 0    then 'IN_PROGRESS'::public.progress_status
    else 'NOT_STARTED'::public.progress_status
  end;

  update public.edital_subjects
     set progress_studied = new_progress,
         status = new_status
   where id = _topic_id;
end;
$$;

grant execute on function public.sync_topic_progress(uuid) to authenticated;
