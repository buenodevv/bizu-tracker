-- =============================================================================
-- Bizu Tracker — Avatar do usuário
--
-- Guarda a URL pública da foto de perfil em `profiles.avatar_url` e cria o
-- bucket `avatars` no Storage, com políticas que garantem que cada usuário só
-- escreve na própria pasta (avatars/<uid>/arquivo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna na tabela de perfis
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'URL pública da foto de perfil no bucket `avatars`.';

-- -----------------------------------------------------------------------------
-- 2. Bucket de Storage (público para leitura, com limite de 2 MB)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 3. Políticas do Storage
--    Leitura: livre (bucket público, usado em <img>).
--    Escrita: apenas na própria pasta — avatars/<auth.uid()>/...
-- -----------------------------------------------------------------------------
drop policy if exists "avatars: leitura pública" on storage.objects;
create policy "avatars: leitura pública"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: inserir próprio" on storage.objects;
create policy "avatars: inserir próprio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: atualizar próprio" on storage.objects;
create policy "avatars: atualizar próprio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: excluir próprio" on storage.objects;
create policy "avatars: excluir próprio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
