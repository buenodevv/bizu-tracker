-- =============================================================================
-- Bizu Tracker — Cota genérica de IA e operações seguras na árvore do edital
--
-- 1. Cota mensal por tipo de uso de IA (extração, refinamento, etc.), com
--    limites em tabela para permitir planos de assinatura no futuro.
-- 2. `merge_edital_subject`: mescla dois nós do mesmo nível preservando
--    sessões, questões e blocos de ciclo que apontavam para o nó removido.
-- 3. `move_edital_subject`: move um nó para outro pai do mesmo nível,
--    impedindo ciclos e mudança de profundidade.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Limites mensais por tipo de uso (hoje, um único conjunto FREE)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_quota_limits (
  kind text primary key,
  monthly_limit int not null check (monthly_limit > 0)
);

-- Configuração de limites: ninguém além das funções (security definer)
-- precisa ler ou alterar. Sem policies, o RLS bloqueia o acesso via API.
alter table public.ai_quota_limits enable row level security;
revoke all on public.ai_quota_limits from anon, authenticated;

insert into public.ai_quota_limits (kind, monthly_limit) values
  ('extraction', 10),
  ('refine', 5),
  ('complete', 5),
  ('plan_cycle', 3)
on conflict (kind) do nothing;

-- Consumo mensal por usuário e tipo.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  kind text not null,
  count int not null default 0,
  primary key (user_id, month, kind)
);

alter table public.ai_usage enable row level security;
-- Sem policies: o acesso acontece apenas pela função abaixo.

create or replace function public.consume_ai_quota(_kind text)
returns table (allowed boolean, remaining int, monthly_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used int;
  lim int;
  month_start date := date_trunc('month', (now() at time zone 'utc'))::date;
begin
  if uid is null then
    return query select false, 0, 0;
    return;
  end if;

  select l.monthly_limit into lim
    from public.ai_quota_limits l
   where l.kind = _kind;

  -- Tipo desconhecido: nega em vez de criar contador sem limite.
  if lim is null then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.ai_usage as u (user_id, month, kind, count)
  values (uid, month_start, _kind, 1)
  on conflict (user_id, month, kind) do update
    set count = u.count + 1
  returning count into used;

  return query select used <= lim, greatest(lim - used, 0), lim;
end;
$$;

revoke execute on function public.consume_ai_quota(text) from public;
revoke execute on function public.consume_ai_quota(text) from anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

-- Mantém a função antiga funcionando (mesmo comportamento mensal) para não
-- quebrar uma versão do app em deploy durante a transição.
create or replace function public.consume_extraction_quota()
returns table (allowed boolean, remaining int)
language sql
security definer
set search_path = public
as $$
  select q.allowed, q.remaining from public.consume_ai_quota('extraction') q;
$$;

revoke execute on function public.consume_extraction_quota() from public;
revoke execute on function public.consume_extraction_quota() from anon;
grant execute on function public.consume_extraction_quota() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Profundidade de um nó (raiz = 1)
-- -----------------------------------------------------------------------------
create or replace function public.edital_subject_depth(_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with recursive up as (
    select s.id, s.parent_id, 1 as depth
      from public.edital_subjects s
     where s.id = _id
    union all
    select s.id, s.parent_id, up.depth + 1
      from public.edital_subjects s
      join up on s.id = up.parent_id
  )
  select max(depth) from up;
$$;

revoke execute on function public.edital_subject_depth(uuid) from public;
revoke execute on function public.edital_subject_depth(uuid) from anon;
revoke execute on function public.edital_subject_depth(uuid) from authenticated;

-- -----------------------------------------------------------------------------
-- 3. Mesclagem de nós
-- -----------------------------------------------------------------------------
create or replace function public.merge_edital_subject(_keep uuid, _merge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_edital uuid;
  keep_parent uuid;
  keep_name text;
  merge_edital uuid;
  merge_parent uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if _keep = _merge then
    raise exception 'cannot merge a node into itself';
  end if;

  select s.edital_id, s.parent_id, s.name
    into keep_edital, keep_parent, keep_name
    from public.edital_subjects s
    join public.editals e on e.id = s.edital_id
   where s.id = _keep and e.user_id = auth.uid();

  select s.edital_id, s.parent_id
    into merge_edital, merge_parent
    from public.edital_subjects s
    join public.editals e on e.id = s.edital_id
   where s.id = _merge and e.user_id = auth.uid();

  if keep_edital is null or merge_edital is null then
    raise exception 'subject not found';
  end if;
  if keep_edital <> merge_edital then
    raise exception 'subjects belong to different editais';
  end if;
  if keep_parent is distinct from merge_parent then
    raise exception 'subjects must share the same parent';
  end if;

  -- Sessões e questões do dono passam a apontar para o nó mantido,
  -- preservando o nome atualizado no snapshot.
  update public.study_sessions
     set topic_id = _keep, topic_name = keep_name
   where topic_id = _merge
     and user_id = auth.uid();

  update public.questions
     set topic_id = _keep, topic_name = keep_name
   where topic_id = _merge
     and user_id = auth.uid();

  update public.cycle_blocks b
     set topic_id = _keep, topic_name = keep_name
    from public.cycles c
   where b.cycle_id = c.id
     and c.user_id = auth.uid()
     and b.topic_id = _merge;

  -- Filhos do nó mesclado passam para o nó mantido.
  update public.edital_subjects
     set parent_id = _keep
   where parent_id = _merge;

  delete from public.edital_subjects where id = _merge;
end;
$$;

revoke execute on function public.merge_edital_subject(uuid, uuid) from public;
revoke execute on function public.merge_edital_subject(uuid, uuid) from anon;
grant execute on function public.merge_edital_subject(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Movimentação de nós (mesmo nível)
-- -----------------------------------------------------------------------------
create or replace function public.move_edital_subject(_id uuid, _parent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  node_edital uuid;
  node_depth int;
  target_edital uuid;
  target_depth int;
  is_descendant boolean;
  next_order int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if _parent = _id then
    raise exception 'cannot move a node into itself';
  end if;

  select s.edital_id into node_edital
    from public.edital_subjects s
    join public.editals e on e.id = s.edital_id
   where s.id = _id and e.user_id = auth.uid();

  if node_edital is null then
    raise exception 'subject not found';
  end if;

  node_depth := public.edital_subject_depth(_id);

  if _parent is null then
    -- Apenas um nó raiz pode permanecer raiz.
    if node_depth <> 1 then
      raise exception 'only root subjects can stay at the root';
    end if;
    target_depth := 0;
  else
    select s.edital_id into target_edital
      from public.edital_subjects s
     where s.id = _parent;

    if target_edital is null or target_edital <> node_edital then
      raise exception 'invalid target parent';
    end if;

    target_depth := public.edital_subject_depth(_parent);

    -- Impede mudar a profundidade (tópico continua tópico etc.).
    if target_depth <> node_depth - 1 then
      raise exception 'cannot change the tree level';
    end if;

    -- O destino não pode ser descendente do nó movido.
    with recursive down as (
      select s.id from public.edital_subjects s where s.parent_id = _id
      union all
      select s.id
        from public.edital_subjects s
        join down d on s.parent_id = d.id
    )
    select exists (select 1 from down where id = _parent)
      into is_descendant;

    if is_descendant then
      raise exception 'cannot move a node into its own descendant';
    end if;
  end if;

  select coalesce(max(sort_order) + 1, 0) into next_order
    from public.edital_subjects
   where edital_id = node_edital
     and parent_id is not distinct from _parent;

  update public.edital_subjects
     set parent_id = _parent,
         sort_order = next_order
   where id = _id;
end;
$$;

revoke execute on function public.move_edital_subject(uuid, uuid) from public;
revoke execute on function public.move_edital_subject(uuid, uuid) from anon;
grant execute on function public.move_edital_subject(uuid, uuid) to authenticated;
