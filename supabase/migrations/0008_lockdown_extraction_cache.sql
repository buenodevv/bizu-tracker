-- =============================================================================
-- Bizu Tracker — Bloqueio do cache de extração de edital
--
-- O cache é global (compartilhado entre usuários) e não pode ser lido nem
-- escrito diretamente por usuários autenticados: isso permitia vazamento
-- entre contas, envenenamento de cache e payloads malformados.
--
-- A partir desta migration, leitura e escrita acontecem apenas no servidor,
-- com a service role (src/lib/supabase/admin.ts). Sem a service role
-- configurada, a extração continua funcionando, apenas sem cache.
-- =============================================================================

-- RLS permanece habilitado: sem policies, anon e authenticated não acessam
-- nenhuma linha. A service role ignora RLS por definição.
drop policy if exists "cache: read authenticated" on public.edital_extraction_cache;
drop policy if exists "cache: insert authenticated" on public.edital_extraction_cache;
drop policy if exists "cache: update authenticated" on public.edital_extraction_cache;

-- O contador de acertos também passa a ser exclusivo do servidor.
revoke execute on function public.bump_extraction_cache_hit(text) from public;
revoke execute on function public.bump_extraction_cache_hit(text) from anon;
revoke execute on function public.bump_extraction_cache_hit(text) from authenticated;
grant execute on function public.bump_extraction_cache_hit(text) to service_role;
