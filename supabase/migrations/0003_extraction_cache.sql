-- =============================================================================
-- Bizu Tracker — Cache de extração de edital (economia de tokens de IA)
--
-- A chave é o hash SHA-256 do texto normalizado do PDF. Dois usuários que
-- enviam o mesmo edital compartilham o resultado: a IA roda UMA vez.
-- =============================================================================

create table if not exists public.edital_extraction_cache (
  content_hash text primary key,
  payload jsonb not null,           -- ExtractedEdital serializado
  provider text not null default 'gemini',
  model text,
  hit_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_extraction_cache_created
  on public.edital_extraction_cache (created_at desc);

-- -----------------------------------------------------------------------------
-- RLS: leitura liberada para autenticados (é conteúdo público de edital),
-- escrita apenas via service role / funções do servidor.
-- -----------------------------------------------------------------------------
alter table public.edital_extraction_cache enable row level security;

drop policy if exists "cache: read authenticated" on public.edital_extraction_cache;
create policy "cache: read authenticated"
  on public.edital_extraction_cache for select
  to authenticated
  using (true);

drop policy if exists "cache: insert authenticated" on public.edital_extraction_cache;
create policy "cache: insert authenticated"
  on public.edital_extraction_cache for insert
  to authenticated
  with check (true);

-- Permite incrementar o contador de acertos.
drop policy if exists "cache: update authenticated" on public.edital_extraction_cache;
create policy "cache: update authenticated"
  on public.edital_extraction_cache for update
  to authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- Função para registrar um acerto no cache de forma atômica.
-- -----------------------------------------------------------------------------
create or replace function public.bump_extraction_cache_hit(_hash text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.edital_extraction_cache
     set hit_count = hit_count + 1
   where content_hash = _hash;
$$;

grant execute on function public.bump_extraction_cache_hit(text) to authenticated;
