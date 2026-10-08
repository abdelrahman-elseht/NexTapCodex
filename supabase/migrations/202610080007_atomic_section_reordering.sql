create or replace function public.reorder_page_sections(
  target_page_id uuid,
  ordered_section_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  section_count integer;
  maximum_position integer;
  position_offset integer;
begin
  if (select auth.uid()) is null or not private.is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform 1
  from public.business_pages
  where id = target_page_id
  for update;

  if not found then
    raise exception 'page not found' using errcode = 'P0002';
  end if;

  select count(*), coalesce(max(position), -1)
    into section_count, maximum_position
  from public.page_sections
  where page_id = target_page_id;

  if section_count > 100
    or coalesce(array_length(ordered_section_ids, 1), 0) <> section_count
    or (
      select count(distinct section_id)
      from unnest(ordered_section_ids) as requested(section_id)
    ) <> section_count
    or exists (
      select 1
      from unnest(ordered_section_ids) as requested(section_id)
      left join public.page_sections as section
        on section.id = requested.section_id
       and section.page_id = target_page_id
      where section.id is null
    ) then
    raise exception 'section order must contain every page section exactly once' using errcode = '22023';
  end if;

  position_offset := maximum_position + section_count + 1;
  if maximum_position + position_offset + section_count > 32767 then
    raise exception 'section positions exceed the supported range' using errcode = '22003';
  end if;

  update public.page_sections
  set position = position + position_offset,
      updated_at = statement_timestamp()
  where page_id = target_page_id;

  update public.page_sections as section
  set position = requested.ordinality - 1,
      updated_at = statement_timestamp()
  from unnest(ordered_section_ids) with ordinality as requested(section_id, ordinality)
  where section.id = requested.section_id
    and section.page_id = target_page_id;
end;
$function$;

revoke all on function public.reorder_page_sections(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_page_sections(uuid, uuid[]) to authenticated;
