begin;
alter table public.business_pages add column contact_config jsonb not null default '{}'::jsonb
  check (octet_length(contact_config::text) <= 65536);
alter table public.business_pages add column draft_revision bigint not null default 0;
alter table public.businesses add column draft_revision bigint not null default 0;
alter table public.media_assets add column contact_photo_path text;

create function private.bump_draft_revision() returns trigger language plpgsql set search_path='' as $$
begin new.draft_revision := old.draft_revision + 1; return new; end; $$;
create trigger contact_page_revision before update on public.business_pages for each row execute function private.bump_draft_revision();
create trigger contact_business_revision before update on public.businesses for each row execute function private.bump_draft_revision();

create function private.contact_phone(value text) returns text language sql immutable set search_path='' as $$
  select case when n ~ '^01[0-9]{9}$' then '+20' || substring(n from 2)
    when n ~ '^201[0-9]{9}$' then '+' || n when n ~ '^\+[1-9][0-9]{6,14}$' then n else '' end
  from (select regexp_replace(trim(value),'[[:space:]().-]','','g') n) normalized;
$$;
create function private.contact_web(value text) returns boolean language sql immutable set search_path='' as $$
 select length(value) <= 2048 and value ~ '^https?://[^/@[:space:]]+(\.[^/@[:space:]]+|:[0-9]+|/|$)' and value !~ '[[:cntrl:][:space:]]' and value !~ '^https?://[^/]*@';
$$;

create function private.contact_text(value jsonb, max_chars integer default 2000) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='string' and length(value#>>'{}') <= max_chars
   and octet_length(value#>>'{}') <= 8192
   and (value#>>'{}') !~ '[\x01-\x08\x0B-\x1F\x7F]',false);
$$;

-- The database compiles the public allowlist, including callers of legacy publish_page.
create function private.compile_contact(target_page_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.business_pages; c jsonb; f jsonb; v text; name text; phone text; fields jsonb := '[]'; note text := ''; photo text; source jsonb; ids text[] := '{}';
begin
 select * into p from public.business_pages where id=target_page_id;
 c := p.contact_config;
 if c = '{}'::jsonb then return null; end if;
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'enabled') is distinct from 'boolean' or jsonb_typeof(c->'fields') is distinct from 'array'
   or jsonb_array_length(c->'fields') > 30 or octet_length(c::text) > 65536 then raise exception 'invalid contact configuration'; end if;
 if exists(select 1 from jsonb_object_keys(c) k where k not in ('enabled','displayName','organization','primaryPhone','nameFromPage','phoneFromPage','photoUrl','photoAssetId','fields'))
   or not private.contact_text(c->'displayName') or not private.contact_text(c->'organization') or not private.contact_text(c->'primaryPhone')
   or (c ? 'nameFromPage' and jsonb_typeof(c->'nameFromPage') is distinct from 'boolean')
   or (c ? 'phoneFromPage' and jsonb_typeof(c->'phoneFromPage') is distinct from 'boolean')
   or (c ? 'photoUrl' and (jsonb_typeof(c->'photoUrl') is distinct from 'string' or length(c->>'photoUrl')>2048))
   then raise exception 'invalid contact core'; end if;
 for f in select value from jsonb_array_elements(c->'fields') loop
   if jsonb_typeof(f) is distinct from 'object' or not private.contact_text(f->'id',100) or not private.contact_text(f->'label',100) or not private.contact_text(f->'value') or coalesce(f->>'id','') = '' or length(f->>'id') > 100 or f->>'id' = any(ids) or length(coalesce(f->>'label','')) > 100
     or coalesce(f->>'kind','') not in ('phone','email','website','address','whatsapp','social','hours','notes','custom')
     or jsonb_typeof(f->'enabled') is distinct from 'boolean' or length(coalesce(f->>'value','')) > 2000 or octet_length(coalesce(f->>'value','')) > 8192
     then raise exception 'invalid contact field'; end if;
   if exists(select 1 from jsonb_object_keys(f) k where k not in ('id','kind','label','value','enabled','binding')) then raise exception 'invalid contact field property'; end if;
   if f ? 'binding' then
     if jsonb_typeof(f->'binding') is distinct from 'object' or not private.contact_text(f#>'{binding,sectionKey}',40)
       or coalesce(f#>>'{binding,property}','') not in ('value','url','phone','email','address')
       or (f#>'{binding,itemId}' is not null and not private.contact_text(f#>'{binding,itemId}',200))
       or exists(select 1 from jsonb_object_keys(f->'binding') k where k not in ('sectionKey','itemId','property'))
       then raise exception 'invalid contact binding'; end if;
   end if;
   ids := array_append(ids,f->>'id');
 end loop;
 if octet_length(jsonb_build_object('displayName',c->'displayName','organization',c->'organization','primaryPhone',c->'primaryPhone','fields',(select jsonb_agg(jsonb_build_object('id',entry->'id','value',entry->'value')) from jsonb_array_elements(c->'fields') entry))::text)>16384 then raise exception 'page contact overrides exceed 16 KiB'; end if;
 if c->>'enabled' <> 'true' then return null; end if;
 name := case when c->>'nameFromPage' = 'true' then coalesce(nullif(p.branch_name,''),(select b.name from public.businesses b where b.id=p.business_id)) else c->>'displayName' end;
 phone := private.contact_phone(case when c->>'phoneFromPage' = 'true' then (select s.content->>'phone' from public.page_sections s where s.page_id=p.id and s.kind='contact' and s.enabled order by s.position limit 1) else c->>'primaryPhone' end);
 if coalesce(trim(name),'') = '' or coalesce(phone,'') = '' then raise exception 'contact requires display name and primary phone'; end if;
 if not private.contact_text(to_jsonb(name)) or length(name) > 2000 or octet_length(name) > 8192 or length(coalesce(c->>'organization','')) > 2000 or octet_length(coalesce(c->>'organization','')) > 8192 then raise exception 'contact core text too long'; end if;
 for f in select value from jsonb_array_elements(c->'fields') where value->>'enabled'='true' loop
   v := f->>'value';
   if f ? 'binding' then
     if f#>>'{binding,property}' not in ('value','url','phone','email','address') then raise exception 'invalid contact binding'; end if;
     select s.content into source from public.page_sections s where s.page_id=p.id and s.section_key=f#>>'{binding,sectionKey}' and s.enabled and s.kind not in ('payments','gallery');
     if f#>>'{binding,itemId}' is not null then
       select item into source from jsonb_array_elements(coalesce(source->'items','[]')) item where item->>'id'=f#>>'{binding,itemId}' and coalesce(item->>'enabled','true')='true' and coalesce(item->>'provider','') not in ('instapay','vodafone','etisalat','orange','bank');
     end if;
     v := source->>(f#>>'{binding,property}');
   end if;
   if not private.contact_text(to_jsonb(v)) or coalesce(trim(v),'') = '' or length(v)>2000 or octet_length(v)>8192 then raise exception 'contact field value missing or too long'; end if;
   if f->>'kind'='phone' then v := private.contact_phone(v); if coalesce(v,'')='' then raise exception 'invalid contact phone'; end if; end if;
   if f->>'kind'='email' and (length(v)>254 or v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid contact email'; end if;
   if f->>'kind' in ('website','social','whatsapp') and not private.contact_web(v) then raise exception 'invalid contact URL'; end if;
   if f->>'kind' in ('social','whatsapp','hours','notes','custom') then note := note || case when note='' then '' else E'\n' end || coalesce(nullif(f->>'label',''),f->>'kind') || ': ' || v; end if;
   fields := fields || jsonb_build_array(jsonb_build_object('kind',f->>'kind','label',coalesce(f->>'label',''),'value',v));
 end loop;
 if length(note)>8000 or octet_length(note)>32768 then raise exception 'contact notes too long'; end if;
 if c->>'photoAssetId' is not null then
   select m.contact_photo_path into photo from public.media_assets m where m.id=(c->>'photoAssetId')::uuid and m.business_id=p.business_id;
   if not found or photo is null or photo !~ '^[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}\.contact\.jpg$' then raise exception 'contact photo is not owned by business or has no derivative'; end if;
 end if;
 return jsonb_strip_nulls(jsonb_build_object('version',1,'enabled',true,'displayName',name,'organization',coalesce(c->>'organization',''),'primaryPhone',phone,'fields',fields,'photoPath',photo));
end; $$;

create function private.freeze_contact() returns trigger language plpgsql security definer set search_path='' as $$
declare contact jsonb;
begin
 contact := private.compile_contact(new.page_id);
 new.snapshot := (new.snapshot - 'contact') || case when contact is null then '{}'::jsonb else jsonb_build_object('contact',contact) end;
 return new;
end; $$;
create trigger freeze_publication_contact before insert on public.page_publications for each row execute function private.freeze_contact();

-- One transaction for revision checks, complete draft persistence, validation and optional publication.
create function public.save_contact_draft(draft jsonb, expected_page_revision bigint, expected_business_revision bigint, publish boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.business_pages; b public.businesses; result jsonb; row jsonb;
begin
 if auth.uid() is null or not private.is_owner() then raise exception 'not authorized' using errcode='42501'; end if;
 select * into b from public.businesses where id=(draft->>'businessId')::uuid for update;
 select * into p from public.business_pages where id=(draft->>'pageId')::uuid and business_id=b.id for update;
 if p.id is null then raise exception 'page not found'; end if;
 if p.draft_revision is distinct from expected_page_revision or b.draft_revision is distinct from expected_business_revision then raise exception 'This draft changed in another session. Your local edits are preserved; reload in another tab to compare.' using errcode='40001'; end if;
 select jsonb_agg(jsonb_build_object('section_key',s->>'key','kind',s->>'kind','title',s->>'title','position',s->'position','enabled',s->'enabled','content',s->'content') order by ordinal) into row from jsonb_array_elements(draft->'sections') with ordinality as sections(s,ordinal);
 result := private.save_page_draft(b.id,p.id,draft->>'name',draft->>'category',case when (draft->>'archived')::boolean then 'archived' else 'active' end,draft->>'slug',draft->>'template',row,draft->'providerProfiles');
 update public.business_pages set contact_config=case when draft ? 'contact' then draft->'contact' else contact_config end where id=p.id;
 perform private.compile_contact(p.id);
 if publish then result := private.publish_page(p.id); end if;
 return result || jsonb_build_object('ok',true,'pageRevision',(select draft_revision from public.business_pages where id=p.id),'businessRevision',(select draft_revision from public.businesses where id=b.id));
end; $$;
revoke all on function public.save_contact_draft(jsonb,bigint,bigint,boolean) from public,anon;
grant execute on function public.save_contact_draft(jsonb,bigint,bigint,boolean) to authenticated;
revoke all on function private.bump_draft_revision(), private.contact_phone(text), private.contact_web(text), private.compile_contact(uuid), private.freeze_contact() from public,anon,authenticated;
-- Stable resolver composition runs within one statement snapshot, so a token cannot
-- resolve one assignment and then download a different page after reassignment.
create function public.get_card_contact(card_token text) returns jsonb
language sql stable security invoker set search_path='' as $$
 with resolved as materialized (select private.resolve_card(card_token) r)
 select private.get_published_page(r->>'slug')->'contact' from resolved where r->>'state'='active';
$$;
revoke all on function public.get_card_contact(text) from public;
grant execute on function public.get_card_contact(text) to anon,authenticated;
revoke all on function private.contact_text(jsonb,integer) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
