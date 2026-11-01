-- Run with psql against the isolated rehearsal database only.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\pset pager off

DO $$
BEGIN
  IF current_database() <> 'phase2_staging_rehearsal_20261031'
     OR current_user <> 'supabase_admin' THEN
    RAISE EXCEPTION 'wrong rehearsal target or role';
  END IF;
END;
$$;

BEGIN;

SELECT md5(coalesce(string_agg(item, E'\n' ORDER BY item), '')) AS fingerprint
FROM (
  SELECT 'table|' || n.nspname || '.' || c.relname || '|' || c.relkind::text || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity || '|' || coalesce(c.relacl::text, '') AS item
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private') AND c.relkind IN ('r', 'p', 'v', 'm')
  UNION ALL
  SELECT 'column|' || n.nspname || '.' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|' || a.attnotnull || '|' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS item
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE n.nspname IN ('public', 'private') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'index|' || n.nspname || '.' || i.relname || '|' || pg_get_indexdef(i.oid) AS item
  FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
  WHERE n.nspname IN ('public', 'private') AND i.relkind = 'i'
  UNION ALL
  SELECT 'constraint|' || n.nspname || '.' || t.relname || '.' || c.conname || '|' || pg_get_constraintdef(c.oid) || '|' || c.condeferrable || '|' || c.condeferred AS item
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private')
  UNION ALL
  SELECT 'function|' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || md5(pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '') || '|' || p.prosecdef || '|' || coalesce(p.proconfig::text, '') AS item
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private') AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'policy|' || n.nspname || '.' || t.relname || '.' || p.polname || '|' || p.polcmd::text || '|' || p.polroles::text || '|' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS item
  FROM pg_policy p
  JOIN pg_class t ON t.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private')
  UNION ALL
  SELECT 'trigger|' || n.nspname || '.' || t.relname || '.' || g.tgname || '|' || pg_get_triggerdef(g.oid) AS item
  FROM pg_trigger g
  JOIN pg_class t ON t.oid = g.tgrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private') AND NOT g.tgisinternal
  UNION ALL
  SELECT 'event-trigger|' || e.evtname || '|' || e.evtenabled::text || '|' || e.evtevent::text || '|' || coalesce(array_to_string(e.evttags, ','), '') || '|' || e.evtfoid::regprocedure::text AS item
  FROM pg_event_trigger e
) catalog_items;
\gset before_
\echo BEFORE_CATALOG_FINGERPRINT :before_fingerprint

\ir phase2-staging-forward-reconciliation.sql

DO $$
DECLARE
  routine_definition text;
  key_deferrable boolean;
  position_deferrable boolean;
  enabled_count integer;
  policy_count integer;
BEGIN
  IF (SELECT count(*) FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public' AND i.relkind = 'i'
        AND i.relname = ANY (ARRAY['businesses_created_id_idx', 'cards_created_id_idx', 'card_batches_created_id_idx', 'card_history_card_created_id_idx'])) <> 4 THEN
    RAISE EXCEPTION 'the four approved keyset indexes were not created';
  END IF;

  IF to_regprocedure('private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'a draft-save overload is missing';
  END IF;

  routine_definition := pg_get_functiondef('private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)'::regprocedure);
  IF position('private.has_capability(''edit'')' IN routine_definition) = 0
     OR position('position_offset' IN routine_definition) = 0 THEN
    RAISE EXCEPTION 'the nine-argument private draft-save body is not Main-aligned';
  END IF;

  IF to_regprocedure('private.update_business_page(uuid,uuid,text,text,text,text,text)') IS NULL
     OR to_regprocedure('public.update_business_page(uuid,uuid,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'an update_business_page overload is missing';
  END IF;
  routine_definition := pg_get_functiondef('private.update_business_page(uuid,uuid,text,text,text,text,text)'::regprocedure);
  IF position('private.has_capability(''edit'')' IN routine_definition) = 0
     OR position('business_pages' IN routine_definition) = 0 THEN
    RAISE EXCEPTION 'private.update_business_page lacks the approved capability or relationship guard';
  END IF;

  IF NOT has_function_privilege('authenticated', 'private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon', 'private.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon', 'public.save_page_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'private.update_business_page(uuid,uuid,text,text,text,text,text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_business_page(uuid,uuid,text,text,text,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'approved function execute grants are not present';
  END IF;

  SELECT c.condeferrable INTO key_deferrable
  FROM pg_constraint c
  WHERE c.conrelid = 'public.page_sections'::regclass
    AND c.contype = 'u'
    AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
         FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ordinality)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
        = ARRAY['page_id','section_key'];
  SELECT c.condeferrable INTO position_deferrable
  FROM pg_constraint c
  WHERE c.conrelid = 'public.page_sections'::regclass
    AND c.contype = 'u'
    AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
         FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ordinality)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
        = ARRAY['page_id','position'];
  IF key_deferrable IS DISTINCT FROM false OR position_deferrable IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'the historical page_sections uniqueness behavior changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_event_trigger e
    JOIN pg_proc p ON p.oid = e.evtfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
      AND e.evtevent = 'ddl_command_end'
      AND e.evttags = ARRAY['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']::text[]
      AND n.nspname = 'public' AND p.proname = 'rls_auto_enable'
      AND p.prosecdef AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[]
  ) THEN
    RAISE EXCEPTION 'the Staging-only ensure_rls trigger metadata changed';
  END IF;

  SELECT count(*) FILTER (WHERE c.relrowsecurity) INTO enabled_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';
  SELECT count(*) INTO policy_count
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public';
  IF enabled_count <> 11 OR policy_count <> 17 THEN
    RAISE EXCEPTION 'public RLS/policy surface changed unexpectedly';
  END IF;
END;
$$;
\echo PROPOSAL_ASSERTIONS_PASS

ROLLBACK;

SELECT md5(coalesce(string_agg(item, E'\n' ORDER BY item), '')) = :'before_fingerprint' AS rollback_match
FROM (
  SELECT 'table|' || n.nspname || '.' || c.relname || '|' || c.relkind::text || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity || '|' || coalesce(c.relacl::text, '') AS item
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private') AND c.relkind IN ('r', 'p', 'v', 'm')
  UNION ALL
  SELECT 'column|' || n.nspname || '.' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|' || a.attnotnull || '|' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS item
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE n.nspname IN ('public', 'private') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'index|' || n.nspname || '.' || i.relname || '|' || pg_get_indexdef(i.oid) AS item
  FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
  WHERE n.nspname IN ('public', 'private') AND i.relkind = 'i'
  UNION ALL
  SELECT 'constraint|' || n.nspname || '.' || t.relname || '.' || c.conname || '|' || pg_get_constraintdef(c.oid) || '|' || c.condeferrable || '|' || c.condeferred AS item
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private')
  UNION ALL
  SELECT 'function|' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || md5(pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '') || '|' || p.prosecdef || '|' || coalesce(p.proconfig::text, '') AS item
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private') AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'policy|' || n.nspname || '.' || t.relname || '.' || p.polname || '|' || p.polcmd::text || '|' || p.polroles::text || '|' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS item
  FROM pg_policy p JOIN pg_class t ON t.oid = p.polrelid JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private')
  UNION ALL
  SELECT 'trigger|' || n.nspname || '.' || t.relname || '.' || g.tgname || '|' || pg_get_triggerdef(g.oid) AS item
  FROM pg_trigger g JOIN pg_class t ON t.oid = g.tgrelid JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname IN ('public', 'private') AND NOT g.tgisinternal
  UNION ALL
  SELECT 'event-trigger|' || e.evtname || '|' || e.evtenabled::text || '|' || e.evtevent::text || '|' || coalesce(array_to_string(e.evttags, ','), '') || '|' || e.evtfoid::regprocedure::text AS item
  FROM pg_event_trigger e
) catalog_items;
\gset after_
\if :after_rollback_match
\echo ROLLBACK_CATALOG_FINGERPRINT_MATCH
\else
\echo ROLLBACK_CATALOG_FINGERPRINT_MISMATCH
\quit 3
\endif
\q
