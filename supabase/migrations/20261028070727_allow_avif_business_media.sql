alter table public.media_assets
  drop constraint if exists media_assets_mime_type_check;

alter table public.media_assets
  add constraint media_assets_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif'));

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'business-media';
