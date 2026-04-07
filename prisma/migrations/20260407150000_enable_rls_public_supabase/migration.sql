-- Security hardening for Supabase PostgREST exposure.
-- Enables RLS on every table in public schema.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      t.schema_name,
      t.table_name
    );
  END LOOP;
END
$$;
