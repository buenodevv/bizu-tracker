-- =============================================================================
-- Bizu Tracker — Remove a leitura pública de `shared_links`
--
-- A tabela ainda não é usada pelo app, mas a policy `using (true)` permitia
-- que qualquer anônimo listasse todos os links: slug, dono, entidade e
-- validade. Quando o compartilhamento por slug for implementado, exponha
-- apenas a resolução por slug via RPC (`security definer`) validando
-- `expires_at` — nunca a tabela inteira.
-- =============================================================================

drop policy if exists "links: public read" on public.shared_links;
