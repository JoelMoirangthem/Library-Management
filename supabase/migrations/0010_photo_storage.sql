-- StudySeat migration 0010: library photos live in Supabase Storage, not inside the library row.
--
-- Before: the app shrank each photo to a base64 text blob and stored it in libraries.photos, so every
-- Discover card downloaded every library's photos inside the list query.
-- Now: photos are files in the public bucket "LibraryImages", one flat folder per owner
--   LibraryImages/<owner user id>/<random file name>.jpg|png
-- and libraries.photos holds only their public links.
--
-- Rules (enforced here in the database, never only in the app):
--   * only an owner can upload, and only into the folder named after their own user id
--   * file names must end in .jpg, .jpeg or .png (the bucket also limits type to JPEG/PNG and size to 5 MB)
--   * at most 20 files per owner, so one account cannot fill the storage
--   * an owner can list and delete their own files; nobody else can write or delete anything
--   * anyone can VIEW a photo by its link (the bucket is public), but nobody can list other people's folders
--   * libraries.photos holds at most 4 links, each pointing at a file in the owner's own folder
--     (so no data: blobs, no other websites, no other owner's images)

-- ---------------------------------------------------------------- bucket (a no-op if it already exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('LibraryImages', 'LibraryImages', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- upload / list / delete rules
create policy "owners upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'LibraryImages'
    and public.current_user_role() = 'owner'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and lower(name) ~ '\.(jpe?g|png)$'
    and (
      select count(*) from storage.objects o
       where o.bucket_id = 'LibraryImages'
         and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 20
  );

create policy "owners list their own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'LibraryImages' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owners delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'LibraryImages' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- what libraries.photos may contain
create function public.photos_are_valid(p text[], owner uuid)
returns boolean
language sql immutable
as $$
  select cardinality(p) <= 4
     and coalesce((
       select bool_and(
         x ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/LibraryImages/' || owner::text || '/[A-Za-z0-9._-]+\.(jpe?g|png)$')
       )
       from unnest(p) x
     ), true)
$$;

alter table public.libraries
  add constraint libraries_photos_valid check (public.photos_are_valid(photos, owner_id));
