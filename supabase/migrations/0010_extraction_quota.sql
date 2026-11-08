-- =============================================================================
-- Bizu Tracker — Cota diária de extração por IA
--
-- Proteção de custo: cada usuário pode disparar no máximo 20 extrações por
-- dia (UTC). O contador é incrementado de forma atômica dentro do banco, e o
-- RPC é `security definer` porque `authenticated` não tem acesso à tabela.
--
-- O limite é fixo aqui (e não recebido por parâmetro) de propósito: um RPC
-- que aceitasse o limite permitiria que o próprio usuário o aumentasse.
-- =============================================================================

create table if not exists public.extraction_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.extraction_usage enable row level security;
-- Sem policies: o acesso acontece apenas pela função abaixo.

create or replace function public.consume_extraction_quota()
returns table (allowed boolean, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used int;
  daily_limit constant int := 20;
begin
  if uid is null then
    return query select false, 0;
    return;
  end if;

  insert into public.extraction_usage as u (user_id, day, count)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
  returning count into used;

  return query select used <= daily_limit, greatest(daily_limit - used, 0);
end;
$$;

revoke execute on function public.consume_extraction_quota() from public;
revoke execute on function public.consume_extraction_quota() from anon;
grant execute on function public.consume_extraction_quota() to authenticated;
