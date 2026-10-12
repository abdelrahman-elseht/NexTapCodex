-- Keep the alias table owner-only at the Data API privilege layer.
-- Its authenticated owner policy remains unchanged; public reads use RPCs.
revoke all on table public.page_slug_aliases from public, anon;
grant select, insert, update, delete on table public.page_slug_aliases to authenticated;
