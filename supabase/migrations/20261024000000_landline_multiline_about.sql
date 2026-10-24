begin;

-- Flexible dial safety for phone/call entries. The returned value is the
-- owner-entered display value; wire serializers strip separators later.
create or replace function private.contact_phone(value text) returns text
language sql immutable set search_path='' as $$
  select case when coalesce(value,'') <> ''
    and value !~ '[^+0-9*# ().-]'
    and regexp_replace(value,'[ ().-]','','g') ~ '^\+?[0-9*#]+$'
    and value ~ '[0-9]' then value else '' end;
$$;

create function private.contact_binding_source(target_page_id uuid, binding jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare source jsonb;
begin
  if jsonb_typeof(binding) is distinct from 'object'
    or not private.contact_text(binding->'sectionKey',40)
    or coalesce(binding->>'property','') not in ('value','url','phone','email','address')
    or (binding ? 'itemId' and not private.contact_text(binding->'itemId',200))
    or exists(select 1 from jsonb_object_keys(binding) k where k not in ('sectionKey','itemId','property'))
    then raise exception 'invalid contact binding'; end if;
  select s.content into source from public.page_sections s
   where s.page_id=target_page_id and s.section_key=binding->>'sectionKey' and s.enabled
     and s.kind <> 'gallery' and (s.kind <> 'payments' or (binding ? 'itemId' and binding->>'property'='url'));
  if binding ? 'itemId' then
    select item into source from (
      select i as item from jsonb_array_elements(coalesce(source->'items','[]')) i
      union all
      select a from jsonb_array_elements(coalesce(source->'items','[]')) i
        cross join lateral jsonb_array_elements(coalesce(i->'actions','[]')) a
        where coalesce(i->>'enabled','true')='true'
    ) candidates
    where item->>'id'=binding->>'itemId' and coalesce(item->>'enabled','true')='true'
      and (coalesce(item->>'provider','') not in ('instapay','vodafone','etisalat','orange','bank')
        or (item->>'provider'='instapay' and binding->>'property'='url' and private.contact_web(item->>'url')));
  end if;
  return source;
end; $$;

create or replace function private.compile_contact(target_page_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.business_pages; c jsonb; f jsonb; v text; name text; phone text; fields jsonb := '[]'; note text := ''; photo text; source jsonb; primary_type text; field_type text; ids text[] := '{}';
begin
 select * into p from public.business_pages where id=target_page_id; c := p.contact_config;
 if c = '{}'::jsonb then return null; end if;
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'enabled') is distinct from 'boolean' or jsonb_typeof(c->'fields') is distinct from 'array' or jsonb_array_length(c->'fields') > 30 or octet_length(c::text) > 65536 then raise exception 'invalid contact configuration'; end if;
 if exists(select 1 from jsonb_object_keys(c) k where k not in ('enabled','displayName','organization','primaryPhone','nameFromPage','phoneFromPage','photoUrl','photoAssetId','fields','photoCrop','showDownloadLink','primaryPhoneType','primaryPhoneBinding','primaryPhoneFieldId'))
   or not private.contact_text(c->'displayName') or not private.contact_text(c->'organization') or not private.contact_text(c->'primaryPhone')
   or (c ? 'nameFromPage' and jsonb_typeof(c->'nameFromPage') is distinct from 'boolean')
   or (c ? 'phoneFromPage' and jsonb_typeof(c->'phoneFromPage') is distinct from 'boolean')
   or (c ? 'showDownloadLink' and jsonb_typeof(c->'showDownloadLink') is distinct from 'boolean')
   or (c ? 'photoUrl' and (jsonb_typeof(c->'photoUrl') is distinct from 'string' or length(c->>'photoUrl') > 2048)) then raise exception 'invalid contact core'; end if;
 if octet_length(jsonb_build_object('displayName',c->'displayName','organization',c->'organization','primaryPhone',c->'primaryPhone','fields',(select jsonb_agg(jsonb_build_object('id',entry->'id','value',entry->'value')) from jsonb_array_elements(c->'fields') entry))::text) > 16384 then raise exception 'page contact overrides exceed 16 KiB'; end if;
 if c ? 'primaryPhoneType' and c->>'primaryPhoneType' not in ('mobile','landline','work','other') then raise exception 'invalid primary phone type'; end if;
 if c ? 'primaryPhoneFieldId' and not private.contact_text(c->'primaryPhoneFieldId',100) then raise exception 'invalid primary phone field'; end if;
 if c ? 'photoCrop' then
   if jsonb_typeof(c->'photoCrop') is distinct from 'object' or (select count(*) from jsonb_object_keys(c->'photoCrop')) <> 3 or exists(select 1 from jsonb_object_keys(c->'photoCrop') k where k not in ('x','y','zoom')) then raise exception 'invalid crop'; end if;
   if coalesce((c#>>'{photoCrop,x}')::integer,-1) not between 0 and 1000 or coalesce((c#>>'{photoCrop,y}')::integer,-1) not between 0 and 1000 or coalesce((c#>>'{photoCrop,zoom}')::integer,-1) not between 1000 and 4000 then raise exception 'invalid crop'; end if;
 end if;
 if c ? 'primaryPhoneBinding' then perform private.contact_binding_source(target_page_id,c->'primaryPhoneBinding'); end if;
 for f in select value from jsonb_array_elements(c->'fields') loop
   if jsonb_typeof(f) is distinct from 'object' or not private.contact_text(f->'id',100) or not private.contact_text(f->'label',100) or not private.contact_text(f->'value') or coalesce(f->>'id','')='' or f->>'id'=any(ids) or coalesce(f->>'kind','') not in ('phone','email','website','address','whatsapp','social','hours','notes','custom') or jsonb_typeof(f->'enabled') is distinct from 'boolean' then raise exception 'invalid contact field'; end if;
   if exists(select 1 from jsonb_object_keys(f) k where k not in ('id','kind','label','value','enabled','binding','phoneType')) then raise exception 'invalid contact field property'; end if;
   if f ? 'phoneType' and f->>'phoneType' not in ('mobile','landline','work','other') then raise exception 'invalid phone type'; end if;
   if f ? 'binding' then perform private.contact_binding_source(target_page_id,f->'binding'); end if;
   ids := array_append(ids,f->>'id');
 end loop;
 if c->>'enabled' <> 'true' then return null; end if;
 name := case when c->>'nameFromPage'='true' then coalesce(nullif(p.branch_name,''),(select b.name from public.businesses b where b.id=p.business_id)) else c->>'displayName' end;
 primary_type := c->>'primaryPhoneType';
 phone := case when c->>'phoneFromPage'='true' then (select private.contact_phone(s.content->>'phone') from public.page_sections s where s.page_id=p.id and s.kind='contact' and s.enabled order by s.position limit 1) else private.contact_phone(c->>'primaryPhone') end;
 if c ? 'primaryPhoneBinding' then source := private.contact_binding_source(target_page_id,c->'primaryPhoneBinding'); phone := private.contact_phone(source->>(c#>>'{primaryPhoneBinding,property}')); primary_type := source->>'phoneType'; end if;
 if coalesce(trim(name),'')='' or coalesce(phone,'')='' then raise exception 'contact requires display name and primary phone'; end if;
 for f in select value from jsonb_array_elements(c->'fields') where value->>'enabled'='true' loop
   v := f->>'value'; field_type := f->>'phoneType';
   if f ? 'binding' then source := private.contact_binding_source(target_page_id,f->'binding'); v := source->>(f#>>'{binding,property}'); field_type := coalesce(field_type,source->>'phoneType'); end if;
   if not private.contact_text(to_jsonb(v)) or coalesce(trim(v),'')='' then raise exception 'contact field value missing or too long'; end if;
   if f->>'kind'='phone' then v := private.contact_phone(v); if v='' then raise exception 'invalid contact phone'; end if; end if;
   if f->>'kind'='email' and (length(v)>254 or v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid contact email'; end if;
   if f->>'kind' in ('website','social','whatsapp') and not private.contact_web(v) then raise exception 'invalid contact URL'; end if;
   if f->>'kind' in ('hours','notes','custom') and not private.contact_web(v) then note := note || case when note='' then '' else E'\n' end || coalesce(nullif(f->>'label',''),f->>'kind') || ': ' || v; end if;
   if c->>'primaryPhoneFieldId'=f->>'id' and f->>'kind'='phone' then phone := v; primary_type := field_type; end if;
   fields := fields || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('kind',f->>'kind','label',coalesce(f->>'label',''),'value',v,'phoneType',case when f->>'kind'='phone' then field_type end)));
 end loop;
 if c ? 'primaryPhoneFieldId' and not exists(select 1 from jsonb_array_elements(c->'fields') field where field->>'id'=c->>'primaryPhoneFieldId' and field->>'kind'='phone' and field->>'enabled'='true') then phone := ''; end if;
 if phone='' then raise exception 'contact requires primary phone'; end if;
 if c->>'photoAssetId' is not null then
   select m.storage_path,m.contact_photo_path into v,photo from public.media_assets m where m.id=(c->>'photoAssetId')::uuid and m.business_id=p.business_id;
   if not found then raise exception 'contact photo is not owned by business'; end if;
 else
   v := nullif(c->>'photoUrl','');
   if v is null then select s.content->>'logoUrl' into v from public.page_sections s where s.page_id=p.id and s.kind='hero' and s.enabled order by s.position limit 1; end if;
   select m.storage_path,m.contact_photo_path into v,photo from public.media_assets m where m.business_id=p.business_id and v ~ '^https?://[a-zA-Z0-9.:-]+/storage/v1/object/public/business-media/' and m.storage_path=split_part(v,'/storage/v1/object/public/business-media/',2);
 end if;
 if c ? 'photoCrop' and v is not null then photo := regexp_replace(v,'[.][^.]+$','') || '.crop-' || (c#>>'{photoCrop,x}') || '-' || (c#>>'{photoCrop,y}') || '-' || (c#>>'{photoCrop,zoom}') || '.contact.jpg'; end if;
 if photo is not null and (photo !~ '^[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}/[a-fA-F0-9-]{36}([.]crop-[0-9]{1,4}-[0-9]{1,4}-[0-9]{4})?[.]contact[.]jpg$' or not exists(select 1 from storage.objects o where o.bucket_id='business-media' and o.name=photo)) then photo := null; end if;
 return jsonb_strip_nulls(jsonb_build_object('version',1,'enabled',true,'displayName',name,'organization',coalesce(c->>'organization',''),'primaryPhone',phone,'primaryPhoneType',primary_type,'fields',fields,'photoPath',photo,'showDownloadLink',coalesce((c->>'showDownloadLink')::boolean,true)));
end; $$;

revoke all on function private.contact_phone(text), private.contact_binding_source(uuid,jsonb), private.compile_contact(uuid) from public, anon, authenticated;

-- This trigger is the single CR/CRLF normalization boundary for About body copy.
create function private.normalize_about_copy() returns trigger
language plpgsql set search_path='' as $$
declare body text;
begin
  if new.kind <> 'about' then return new; end if;
  if jsonb_typeof(new.content->'description') is distinct from 'string' then
    if new.content ? 'description' then raise exception 'invalid About copy'; end if;
    return new;
  end if;
  body := replace(replace(new.content->>'description', E'\r\n', E'\n'), E'\r', E'\n');
  if length(body) > 1200 or body ~ '[\x00-\x08\x0B-\x1F\x7F]' then raise exception 'invalid About copy'; end if;
  new.content := jsonb_set(new.content, '{description}', to_jsonb(body));
  return new;
end; $$;
create trigger normalize_about_copy before insert or update of kind,content on public.page_sections for each row execute function private.normalize_about_copy();
revoke all on function private.normalize_about_copy() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
