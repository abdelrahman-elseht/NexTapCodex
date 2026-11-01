-- Transaction-only reset rehearsal. Run only against the isolated rehearsal DB.
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

CREATE TEMP TABLE phase2_copy_counts_before (
  schema_name name NOT NULL,
  table_name name NOT NULL,
  row_count bigint NOT NULL,
  PRIMARY KEY (schema_name, table_name)
) ON COMMIT PRESERVE ROWS;

DO $$
DECLARE
  relation record;
  relation_count bigint;
BEGIN
  FOR relation IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'private', 'auth', 'storage')
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', relation.nspname, relation.relname)
      INTO relation_count;
    INSERT INTO phase2_copy_counts_before
    VALUES (relation.nspname, relation.relname, relation_count);
  END LOOP;
END;
$$;

CREATE TEMP TABLE phase2_copy_sequences_before (
  schema_name name NOT NULL,
  sequence_name name NOT NULL,
  state_fingerprint text NOT NULL,
  PRIMARY KEY (schema_name, sequence_name)
) ON COMMIT PRESERVE ROWS;

DO $$
DECLARE
  sequence_record record;
  sequence_state text;
BEGIN
  FOR sequence_record IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'private') AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'SELECT md5(last_value::text || '':'' || is_called::text) FROM %I.%I',
      sequence_record.nspname,
      sequence_record.relname
    ) INTO sequence_state;
    INSERT INTO phase2_copy_sequences_before
    VALUES (sequence_record.nspname, sequence_record.relname, sequence_state);
  END LOOP;
END;
$$;

CREATE TEMP TABLE phase2_copy_expected_cascade (
  schema_name name NOT NULL,
  table_name name NOT NULL,
  PRIMARY KEY (schema_name, table_name)
) ON COMMIT PRESERVE ROWS;

INSERT INTO phase2_copy_expected_cascade
WITH RECURSIVE truncate_set(relid) AS (
  SELECT unnest(ARRAY[
    'public.businesses'::regclass,
    'public.card_batches'::regclass,
    'public.audit_logs'::regclass
  ])
  UNION
  SELECT fk.conrelid
  FROM pg_constraint fk
  JOIN truncate_set parent ON fk.confrelid = parent.relid
  WHERE fk.contype = 'f'
)
SELECT n.nspname, c.relname
FROM truncate_set s
JOIN pg_class c ON c.oid = s.relid
JOIN pg_namespace n ON n.oid = c.relnamespace;

DO $$
DECLARE
  actual_targets text[];
BEGIN
  SELECT array_agg(format('%I.%I', schema_name, table_name) ORDER BY schema_name, table_name)
  INTO actual_targets
  FROM phase2_copy_expected_cascade;

  IF actual_targets IS DISTINCT FROM ARRAY[
    'private.publication_media',
    'public.audit_logs',
    'public.business_pages',
    'public.businesses',
    'public.card_assignment_history',
    'public.card_batches',
    'public.cards',
    'public.media_assets',
    'public.page_publications',
    'public.page_sections',
    'public.page_slug_aliases'
  ]::text[] THEN
    RAISE EXCEPTION 'unexpected reset cascade set';
  END IF;

  IF EXISTS (
    SELECT 1 FROM phase2_copy_expected_cascade
    WHERE schema_name IN ('auth', 'storage')
       OR (schema_name, table_name) IN (
         ('public', 'owner_users'),
         ('private', 'admin_admissions'),
         ('private', 'card_batch_requests'),
         ('private', 'card_deletion_operations'),
         ('private', 'card_serial_counters'),
         ('private', 'card_token_issuance')
       )
  ) THEN
    RAISE EXCEPTION 'reset cascade reaches a protected table';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class sequence_relation
    JOIN pg_namespace n ON n.oid = sequence_relation.relnamespace
    WHERE n.nspname = 'public'
      AND sequence_relation.relname = 'card_batch_code_seq'
      AND sequence_relation.relkind = 'S'
  ) THEN
    RAISE EXCEPTION 'Staging batch-code sequence is missing';
  END IF;
END;
$$;

SET client_min_messages = warning;
BEGIN;

TRUNCATE public.businesses, public.card_batches, public.audit_logs
CONTINUE IDENTITY CASCADE;

DO $$
DECLARE
  relation record;
  relation_count bigint;
  sequence_record record;
  sequence_state text;
BEGIN
  FOR relation IN SELECT * FROM phase2_copy_expected_cascade
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', relation.schema_name, relation.table_name)
      INTO relation_count;
    IF relation_count <> 0 THEN
      RAISE EXCEPTION 'expected reset table is not empty';
    END IF;
  END LOOP;

  FOR relation IN
    SELECT before_count.*
    FROM phase2_copy_counts_before before_count
    WHERE NOT EXISTS (
      SELECT 1 FROM phase2_copy_expected_cascade expected
      WHERE expected.schema_name = before_count.schema_name
        AND expected.table_name = before_count.table_name
    )
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', relation.schema_name, relation.table_name)
      INTO relation_count;
    IF relation_count <> relation.row_count THEN
      RAISE EXCEPTION 'a table outside the reset cascade changed';
    END IF;
  END LOOP;

  FOR sequence_record IN SELECT * FROM phase2_copy_sequences_before
  LOOP
    EXECUTE format(
      'SELECT md5(last_value::text || '':'' || is_called::text) FROM %I.%I',
      sequence_record.schema_name,
      sequence_record.sequence_name
    ) INTO sequence_state;
    IF sequence_state <> sequence_record.state_fingerprint THEN
      RAISE EXCEPTION 'a sequence changed despite CONTINUE IDENTITY';
    END IF;
  END LOOP;
END;
$$;

\echo RESET_CASCADE_TRANSACTION_ASSERTIONS_PASS
ROLLBACK;

DO $$
DECLARE
  relation record;
  relation_count bigint;
  sequence_record record;
  sequence_state text;
BEGIN
  FOR relation IN SELECT * FROM phase2_copy_counts_before
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', relation.schema_name, relation.table_name)
      INTO relation_count;
    IF relation_count <> relation.row_count THEN
      RAISE EXCEPTION 'rollback did not restore table counts';
    END IF;
  END LOOP;

  FOR sequence_record IN SELECT * FROM phase2_copy_sequences_before
  LOOP
    EXECUTE format(
      'SELECT md5(last_value::text || '':'' || is_called::text) FROM %I.%I',
      sequence_record.schema_name,
      sequence_record.sequence_name
    ) INTO sequence_state;
    IF sequence_state <> sequence_record.state_fingerprint THEN
      RAISE EXCEPTION 'rollback did not restore sequence state';
    END IF;
  END LOOP;
END;
$$;

\echo RESET_CASCADE_ROLLBACK_MATCH
