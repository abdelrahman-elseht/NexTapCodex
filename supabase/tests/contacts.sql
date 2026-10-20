-- Disposable synthetic fixtures only. Also runnable against isolated real Supabase.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text,true);
do $$
declare bid uuid := gen_random_uuid(); pid uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
 d jsonb; c jsonb; r jsonb; old_publication uuid; rev bigint; card_token_value text := repeat('c',40); batch uuid := gen_random_uuid();
begin
 insert into public.businesses(id,name,category) values(bid,'Contact QA','QA');
 insert into public.business_pages(id,business_id,slug,template) values(pid,bid,'contact-contract','professional');
 insert into public.business_pages(id,business_id,slug,template,page_type,parent_page_id,branch_name) values(other_id,bid,'contact-branch','professional','branch',pid,'QA Branch');
 perform public.publish_page(pid);
 if public.get_published_page('contact-contract') ? 'contact' then raise exception 'old contact defaults on'; end if;
 c := '{"enabled":true,"displayName":"Contact QA","organization":"QA","primaryPhone":"01012345678","fields":[{"id":"hidden","kind":"notes","label":"Private","value":"secret","enabled":false},{"id":"public","kind":"website","label":"Second","value":"","enabled":true,"binding":{"sectionKey":"links","itemId":"second","property":"url"}}]}'::jsonb;
 d := jsonb_build_object('businessId',bid,'pageId',pid,'name','Contact QA','category','QA','archived',false,'slug','contact-contract','template','professional','providerProfiles','{}'::jsonb,'contact',c,'sections','[{"key":"links","kind":"links","title":"Links","position":0,"enabled":true,"content":{"items":[{"id":"first","provider":"website","url":"https://first.test"},{"id":"second","provider":"website","url":"https://second.test"}]}}]'::jsonb);
 select public.save_contact_draft(d,p.draft_revision,b.draft_revision,false) into r from public.business_pages p join public.businesses b on b.id=p.business_id where p.id=pid;
 if public.get_published_page('contact-contract') ? 'contact' then raise exception 'draft leaked'; end if;
 begin
   perform public.save_contact_draft(d,0,0,false);
   raise exception 'stale write accepted';
 exception when serialization_failure then null; end;
 select public.save_contact_draft(d,p.draft_revision,b.draft_revision,true) into r from public.business_pages p join public.businesses b on b.id=p.business_id where p.id=pid;
 c := public.get_published_page('contact-contract')->'contact';
 if c->>'primaryPhone' <> '+201012345678' or c#>>'{fields,0,value}' <> 'https://second.test' or jsonb_array_length(c->'fields')<>1 or c::text like '%secret%' or c::text like '%binding%' then raise exception 'bad projection'; end if;
 if (select contact_config from public.business_pages where id=other_id) <> '{}'::jsonb then raise exception 'branch draft changed'; end if;
 old_publication := (r->>'publicationId')::uuid;
 insert into public.card_batches(id,name,quantity,created_by,batch_code) values(batch,'Contact QA',1,auth.uid(),'CONTACT-QA');
 insert into public.cards(batch_id,serial,token,status,page_id) values(batch,'NT-20991020-999999',card_token_value,'active',pid);
 if public.get_card_contact(card_token_value) is distinct from c then raise exception 'card contact missing'; end if;
 update public.cards set status='disabled' where cards.token=card_token_value;
 if public.get_card_contact(card_token_value) is not null then raise exception 'disabled card leaked'; end if;
 -- Invalid save-and-publish rolls back business edits and publication changes.
 select draft_revision into rev from public.business_pages where id=pid;
 begin
   select public.save_contact_draft(jsonb_set(jsonb_set(d,'{name}','"SHOULD ROLLBACK"'),'{contact,primaryPhone}','"invalid"'),p.draft_revision,b.draft_revision,true) into r from public.business_pages p join public.businesses b on b.id=p.business_id where p.id=pid;
   raise exception 'invalid contact accepted';
 exception when raise_exception then if sqlerrm='invalid contact accepted' then raise; end if; end;
 if (select draft_revision from public.business_pages where id=pid)<>rev or (select name from public.businesses where id=bid)<>'Contact QA' or (select published_snapshot_id from public.business_pages where id=pid)<>old_publication then raise exception 'partial save'; end if;
 -- Legacy draft writes preserve the separate contact configuration.
 perform public.save_page_draft(bid,pid,'Contact QA','QA','active','contact-contract','professional','[{"section_key":"hero","kind":"hero","title":"","position":0,"enabled":true,"content":{}}]'::jsonb,'{}'::jsonb);
 if (select contact_config->>'enabled' from public.business_pages where id=pid)<>'true' then raise exception 'legacy erased config'; end if;
 -- Payment values cannot be smuggled through bindings in another section.
 insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content) values(pid,'links','links','',1,true,'{"items":[{"id":"second","provider":"bank","url":"https://bank.test"}]}');
 begin
   perform private.compile_contact(pid); raise exception 'payment binding accepted';
 exception when raise_exception then if sqlerrm='payment binding accepted' then raise; end if; end;
 update public.business_pages set contact_config=jsonb_set(contact_config,'{enabled}','false') where id=pid;
 perform public.publish_page(pid);
 if public.get_published_page('contact-contract') ? 'contact' then raise exception 'disabled contact leaked'; end if;
 if public.get_publication_snapshot(old_publication) is not null then raise exception 'stale snapshot bypass'; end if;
 if has_function_privilege('anon','public.save_contact_draft(jsonb,bigint,bigint,boolean)','execute') then raise exception 'anonymous draft RPC allowed'; end if;
end; $$;
rollback;
