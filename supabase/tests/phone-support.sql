-- Rollback-only fixtures; run on isolated Local Supabase or the disposable contract harness.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text,true);
do $$
declare bid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); cfg jsonb; frozen jsonb; compiled jsonb; v text;
begin
 foreach v in array array['02 2345 6789','(03) 123-4567','+44 (20) 7123-4567','01012345678','123','1','*123#',' 02.1234.5678 '] loop
   if private.contact_phone(v) is distinct from v then raise exception 'safe phone altered: %',v; end if;
 end loop;
 foreach v in array array['','++123','12+34','123;ext=4','123?x=1','123%0aFN:bad','123/45',E'123\n456',E'123\n',E'123\r','javascript:123','abc123','*#',E'123\t456'] loop
   if coalesce(private.contact_phone(v),'') <> '' then raise exception 'unsafe phone accepted: %',v; end if;
 end loop;
 insert into public.businesses(id,name,category) values(bid,'Phone QA','QA');
 insert into public.business_pages(id,business_id,slug,template) values(pid,bid,'phone-support-contract','professional');
 insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content) values(pid,'actions','quick_actions','',0,true,
 '{"items":[{"id":"a","provider":"call","label":"Reception","value":"(02) 2345-6789","phoneType":"landline"},{"id":"b","provider":"call","value":"010 1234 5678","phoneType":"mobile"},{"id":"service","provider":"custom","actions":[{"id":"nested","provider":"call","value":"123","phoneType":"work"}]}]}');
 cfg:='{"enabled":true,"displayName":"Landline Business","organization":"QA","primaryPhone":"","primaryPhoneBinding":{"sectionKey":"actions","itemId":"a","property":"value"},"fields":[{"id":"b","kind":"phone","label":"Manager","value":"","enabled":true,"binding":{"sectionKey":"actions","itemId":"b","property":"value"}},{"id":"c","kind":"phone","label":"Other","value":"*123#","phoneType":"other","enabled":true}]}';
 update public.business_pages set contact_config=cfg where id=pid;
 compiled:=private.compile_contact(pid);
 if compiled->>'primaryPhone' <> '(02) 2345-6789' or compiled->>'primaryPhoneType' <> 'landline'
   or compiled#>>'{fields,0,value}' <> '010 1234 5678' or compiled#>>'{fields,0,phoneType}' <> 'mobile'
   or compiled#>>'{fields,1,value}' <> '*123#' or compiled#>>'{fields,1,phoneType}' <> 'other'
   then raise exception 'phone values or types lost'; end if;
 perform public.publish_page(pid);
 frozen:=public.get_published_page('phone-support-contract')->'contact';
 update public.business_pages set contact_config=(cfg-'primaryPhoneBinding') || '{"primaryPhoneFieldId":"b"}' where id=pid;
 compiled:=private.compile_contact(pid);
 if compiled->>'primaryPhone' <> '010 1234 5678' or compiled->>'primaryPhoneType' <> 'mobile' then raise exception 'contact field primary lost'; end if;
 begin
   update public.business_pages set contact_config=jsonb_set((cfg-'primaryPhoneBinding') || '{"primaryPhoneFieldId":"b"}','{fields,0,enabled}','false') where id=pid;
   perform private.compile_contact(pid); raise exception 'disabled primary field accepted';
 exception when raise_exception then if sqlerrm='disabled primary field accepted' then raise; end if; end;
 begin
   update public.business_pages set contact_config=(cfg-'primaryPhoneBinding') || '{"primaryPhoneFieldId":"missing"}' where id=pid;
   perform private.compile_contact(pid); raise exception 'missing primary field accepted';
 exception when raise_exception then if sqlerrm='missing primary field accepted' then raise; end if; end;
 update public.business_pages set contact_config=jsonb_set(cfg,'{primaryPhoneBinding,itemId}','"nested"') where id=pid;
 if private.compile_contact(pid)->>'primaryPhone' <> '123' then raise exception 'nested binding missing'; end if;
 if public.get_published_page('phone-support-contract')->'contact' is distinct from frozen then raise exception 'phone draft leaked'; end if;
 perform public.publish_page(pid);
 if public.get_published_page('phone-support-contract')#>>'{contact,primaryPhone}' <> '123' then raise exception 'short phone publish failed'; end if;
 -- Landline-only businesses also work without an action binding.
 update public.business_pages set contact_config=(cfg-'primaryPhoneBinding') || '{"primaryPhone":"02 2345 6789","primaryPhoneType":"landline","fields":[]}' where id=pid;
 perform public.publish_page(pid);
 if public.get_published_page('phone-support-contract')#>>'{contact,primaryPhone}' <> '02 2345 6789' then raise exception 'landline-only publish failed'; end if;
 begin
   update public.business_pages set contact_config=jsonb_set(cfg,'{primaryPhoneBinding,sectionKey}','"other-page"') where id=pid;
   perform private.compile_contact(pid); raise exception 'cross-page phone accepted';
 exception when raise_exception then if sqlerrm='cross-page phone accepted' then raise; end if; end;
 begin
   update public.business_pages set contact_config=jsonb_set(cfg,'{fields,1,phoneType}','"CELL;INJECT"') where id=pid;
   perform private.compile_contact(pid); raise exception 'unsafe type accepted';
 exception when raise_exception then if sqlerrm='unsafe type accepted' then raise; end if; end;
 if has_function_privilege('anon','private.contact_binding_source(uuid,jsonb)','execute') then raise exception 'binding helper exposed'; end if;
end; $$;
rollback;
