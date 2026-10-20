begin;
-- Extend the existing private compiler and JSON configuration. No table or RLS changes.
create or replace function private.compile_contact(target_page_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.business_pages; c jsonb; f jsonb; v text; name text; phone text; fields jsonb := '[]'; note text := ''; photo text; source jsonb; ids text[] := '{}';
begin
 select * into p from public.business_pages where id=target_page_id;
 c := p.contact_config;
 if c = '{}'::jsonb then return null; end if;
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'enabled') is distinct from 'boolean' or jsonb_typeof(c->'fields') is distinct from 'array'
   or jsonb_array_length(c->'fields') > 30 or octet_length(c::text) > 65536 then raise exception 'invalid contact configuration'; end if;
 if exists(select 1 from jsonb_object_keys(c) k where k not in ('enabled','displayName','organization','primaryPhone','nameFromPage','phoneFromPage','photoUrl','photoAssetId','fields','photoCrop','showDownloadLink'))
   or not private.contact_text(c->'displayName') or not private.contact_text(c->'organization') or not private.contact_text(c->'primaryPhone')
   or (c ? 'nameFromPage' and jsonb_typeof(c->'nameFromPage') is distinct from 'boolean')
   or (c ? 'phoneFromPage' and jsonb_typeof(c->'phoneFromPage') is distinct from 'boolean')
   or (c ? 'photoUrl' and (jsonb_typeof(c->'photoUrl') is distinct from 'string' or length(c->>'photoUrl')>2048))
   then raise exception 'invalid contact core'; end if;
 if c ? 'showDownloadLink' and jsonb_typeof(c->'showDownloadLink') is distinct from 'boolean' then raise exception 'invalid download visibility'; end if;
 if c ? 'photoCrop' then
   if jsonb_typeof(c->'photoCrop') is distinct from 'object' or (select count(*) from jsonb_object_keys(c->'photoCrop')) <> 3
     or exists(select 1 from jsonb_object_keys(c->'photoCrop') k where k not in ('x','y','zoom')) then raise exception 'invalid contact crop'; end if;
   if exists(select 1 from jsonb_each(c->'photoCrop') e where jsonb_typeof(e.value) <> 'number' or (e.value#>>'{}') !~ '^[0-9]{1,4}$')
     or coalesce((c#>>'{photoCrop,x}')::integer,-1) not between 0 and 1000
     or coalesce((c#>>'{photoCrop,y}')::integer,-1) not between 0 and 1000
     or coalesce((c#>>'{photoCrop,zoom}')::integer,-1) not between 1000 and 4000 then raise exception 'invalid contact crop'; end if;
 end if;
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
   if f->>'kind' in ('hours','notes','custom') and not private.contact_web(v) then note := note || case when note='' then '' else E'\n' end || coalesce(nullif(f->>'label',''),f->>'kind') || ': ' || v; end if;
   fields := fields || jsonb_build_array(jsonb_build_object('kind',f->>'kind','label',coalesce(f->>'label',''),'value',v));
 end loop;
 if length(note)>8000 or octet_length(note)>32768 then raise exception 'contact notes too long'; end if;
 -- Reuse the owned original; never modify it or read mutable draft data at download.
 if c->>'photoAssetId' is not null then
   select m.storage_path,m.contact_photo_path into v,photo from public.media_assets m where m.id=(c->>'photoAssetId')::uuid and m.business_id=p.business_id;
   if not found then raise exception 'contact photo is not owned by business'; end if;
 else
   v := nullif(c->>'photoUrl','');
   if v is null then select s.content->>'logoUrl' into v from public.page_sections s where s.page_id=p.id and s.kind='hero' and s.enabled order by s.position limit 1; end if;
   select m.storage_path,m.contact_photo_path into v,photo from public.media_assets m
     where m.business_id=p.business_id and v ~ '^https?://[a-zA-Z0-9.:-]+/storage/v1/object/public/business-media/'
       and m.storage_path=split_part(v,'/storage/v1/object/public/business-media/',2);
 end if;
 if c ? 'photoCrop' and v is not null then
   photo := regexp_replace(v,'[.][^.]+$','') || '.crop-' || (c#>>'{photoCrop,x}') || '-' || (c#>>'{photoCrop,y}') || '-' || (c#>>'{photoCrop,zoom}') || '.contact.jpg';
 end if;
 -- Missing or invalid images yield a text-only vCard, including legacy logos.
 if photo is not null and (photo !~ '^[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}([.]crop-[0-9]{1,4}-[0-9]{1,4}-[0-9]{4})?[.]contact[.]jpg$'
   or not exists(select 1 from storage.objects o where o.bucket_id='business-media' and o.name=photo)) then photo := null; end if;
 return jsonb_strip_nulls(jsonb_build_object('version',1,'enabled',true,'displayName',name,'organization',coalesce(c->>'organization',''),'primaryPhone',phone,'fields',fields,'photoPath',photo,'showDownloadLink',coalesce((c->>'showDownloadLink')::boolean,true)));
end; $$;

revoke all on function private.compile_contact(uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
