begin;

-- Qualify the outer object name because businesses also has a `name` column.
alter policy owner_media_upload on storage.objects with check (
  bucket_id = 'business-media'
  and private.has_capability('media')
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[2]
  )
);

commit;
