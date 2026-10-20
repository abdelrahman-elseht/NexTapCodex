-- Synthetic rollback-only contract checks; no customer rows are changed.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.owner_users limit 1),'role','authenticated')::text,true);
do $$
declare bid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); oid uuid:=auth.uid();
 path text; photo text; crop text; cfg jsonb; frozen jsonb;
begin
 insert into public.businesses(id,name,category) values(bid,'Synthetic Contacts UX','QA');
 insert into public.business_pages(id,business_id,slug,template) values(pid,bid,'contacts-ux-contract','professional');
 path:=oid::text || '/' || bid::text || '/' || aid::text || '.webp';
 photo:=replace(path,'.webp','.contact.jpg');
 crop:=replace(path,'.webp','.crop-1000-500-2000.contact.jpg');
 insert into public.media_assets(id,business_id,storage_path,contact_photo_path,mime_type,size_bytes) values(aid,bid,path,photo,'image/webp',100);
 insert into storage.objects(bucket_id,name) values('business-media',photo),('business-media',crop);
 insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content) values(pid,'hero','hero','',0,true,jsonb_build_object('logoUrl','https://flkakuysakgwfoemgbwn.supabase.co/storage/v1/object/public/business-media/' || path));
 cfg:='{"enabled":true,"displayName":"Synthetic Contacts UX","organization":"QA","primaryPhone":"01012345678","fields":[]}'::jsonb;
 update public.business_pages set contact_config=cfg where id=pid;
 if private.compile_contact(pid)->>'photoPath' is distinct from photo or private.compile_contact(pid)->>'showDownloadLink' <> 'true' then raise exception 'legacy logo inheritance or visibility default failed'; end if;
 perform public.publish_page(pid);
 frozen:=public.get_published_page('contacts-ux-contract')->'contact';
 cfg:=cfg || '{"showDownloadLink":false,"photoCrop":{"x":1000,"y":500,"zoom":2000}}'::jsonb;
 update public.business_pages set contact_config=cfg where id=pid;
 if public.get_published_page('contacts-ux-contract')->'contact' is distinct from frozen then raise exception 'unpublished crop leaked'; end if;
 if private.compile_contact(pid)->>'photoPath' is distinct from crop then raise exception 'crop cache path mismatch'; end if;
 perform public.publish_page(pid);
 if public.get_published_page('contacts-ux-contract')#>>'{contact,photoPath}' is distinct from crop or public.get_published_page('contacts-ux-contract')#>>'{contact,showDownloadLink}' <> 'false' then raise exception 'crop or visibility publication failed'; end if;
 if (select content->>'logoUrl' from public.page_sections where page_id=pid) not like '%' || path then raise exception 'logo changed'; end if;
 begin
   update public.business_pages set contact_config=jsonb_set(cfg,'{photoCrop,x}','1001') where id=pid;
   perform private.compile_contact(pid); raise exception 'invalid crop accepted';
 exception when raise_exception then if sqlerrm='invalid crop accepted' then raise; end if; end;
 update public.business_pages set contact_config=cfg - 'photoCrop' where id=pid;
 if private.compile_contact(pid)->>'photoPath' is distinct from photo then raise exception 'reset did not restore logo'; end if;
 update public.media_assets set contact_photo_path=replace(photo,'.contact.jpg','.missing.contact.jpg') where id=aid;
 if private.compile_contact(pid) ? 'photoPath' then raise exception 'missing photo did not fall back to text'; end if;
 insert into public.page_sections(page_id,section_key,kind,title,position,enabled,content) values(pid,'payments','payments','',1,true,'{"items":[{"id":"ip","provider":"instapay","value":"qa@instapay","url":"https://www.instapay.me/i?address=qa%40instapay"}]}');
 cfg:=jsonb_set(cfg - 'photoCrop','{fields}','[{"id":"ip","kind":"website","label":"InstaPay","value":"","enabled":true,"binding":{"sectionKey":"payments","itemId":"ip","property":"url"}}]');
 update public.business_pages set contact_config=cfg where id=pid;
 if private.compile_contact(pid)#>>'{fields,0,value}' <> 'https://www.instapay.me/i?address=qa%40instapay' then raise exception 'safe InstaPay URL binding failed'; end if;
 begin
   update public.business_pages set contact_config=jsonb_set(cfg,'{fields,0,binding,property}','"value"') where id=pid;
   perform private.compile_contact(pid); raise exception 'payment identifier binding accepted';
 exception when raise_exception then if sqlerrm='payment identifier binding accepted' then raise; end if; end;
end; $$;
rollback;
