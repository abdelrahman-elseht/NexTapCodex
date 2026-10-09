-- Expand the editor presets while keeping the legacy retail value valid.
alter table public.business_pages drop constraint if exists business_pages_template_check;
alter table public.business_pages add constraint business_pages_template_check
  check (template in ('cafe','restaurant','salon','retail','professional'));
