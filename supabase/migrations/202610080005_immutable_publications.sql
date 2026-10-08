create or replace function private.reject_publication_mutation()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'publications are immutable'; end; $$;
create trigger page_publications_immutable
before update or delete on public.page_publications
for each row execute function private.reject_publication_mutation();
revoke all on function private.reject_publication_mutation() from public,anon,authenticated;