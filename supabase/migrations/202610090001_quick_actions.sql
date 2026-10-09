-- Flexible owner-configured action row. Existing section data remains compatible.
alter table public.page_sections drop constraint if exists page_sections_kind_check;
alter table public.page_sections add constraint page_sections_kind_check check (kind in ('hero','about','hours','contact','quick_actions','social','payments','links','services','gallery','reviews','branch'));
