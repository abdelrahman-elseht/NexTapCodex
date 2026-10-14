create or replace function private.resolve_card(card_token text) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c record;
begin
 select cards.status,cards.serial,business_pages.slug,business_pages.is_active,businesses.status as business_status,business_pages.published_snapshot_id
 into c from public.cards left join public.business_pages on business_pages.id=cards.page_id
 left join public.businesses on businesses.id=business_pages.business_id where cards.token=card_token;
 if not found then return jsonb_build_object('state','invalid'); end if;
 if c.status='unassigned' then return jsonb_build_object('state','unassigned','serial',c.serial); end if;
 if c.status<>'active' or not coalesce(c.is_active,false) or c.business_status<>'active' or c.published_snapshot_id is null
 then return jsonb_build_object('state','inactive'); end if;
 return jsonb_build_object('state','active','slug',c.slug);
end; $$;

create or replace function public.resolve_card(card_token text) returns jsonb language sql stable security invoker set search_path=''
as $$ select private.resolve_card(card_token); $$;

revoke all on function private.resolve_card(text) from public;
grant execute on function private.resolve_card(text) to anon,authenticated;
revoke all on function public.resolve_card(text) from public;
grant execute on function public.resolve_card(text) to anon,authenticated;
