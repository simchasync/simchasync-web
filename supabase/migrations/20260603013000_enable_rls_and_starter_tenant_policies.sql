-- Enforce RLS globally and provide a safe starter policy helper for future tables.
-- 1) Enable RLS on all public tables
-- 2) Force RLS (deny-by-default unless a policy allows access)
-- 3) Add a helper to apply starter tenant-isolation policies table by table

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END
$$;

-- Helper: apply baseline tenant-isolation policies on a specific table.
-- Usage example:
--   SELECT public.apply_starter_tenant_isolation_policies('public.some_new_table'::regclass);
--   SELECT public.apply_starter_tenant_isolation_policies('public.some_table'::regclass, 'workspace_id');
--
-- Behavior:
-- - Skips tables that already have policies (to avoid widening existing access rules).
-- - Creates four starter policies when no policies exist:
--   * starter_internal_select
--   * starter_owner_or_manager_insert
--   * starter_owner_or_manager_update
--   * starter_owner_or_manager_delete
CREATE OR REPLACE FUNCTION public.apply_starter_tenant_isolation_policies(
  _table regclass,
  _tenant_column text DEFAULT 'tenant_id'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _schema text;
  _table_name text;
  _policy_count integer;
  _qualified text;
BEGIN
  SELECT n.nspname, c.relname
  INTO _schema, _table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = _table;

  IF _schema IS NULL OR _table_name IS NULL THEN
    RAISE EXCEPTION 'Table % not found', _table;
  END IF;

  IF _schema <> 'public' THEN
    RAISE EXCEPTION 'Only public schema tables are supported by this helper. Got: %.%', _schema, _table_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = _schema
      AND table_name = _table_name
      AND column_name = _tenant_column
  ) THEN
    RAISE EXCEPTION 'Column % does not exist on %.%', _tenant_column, _schema, _table_name;
  END IF;

  SELECT count(*)
  INTO _policy_count
  FROM pg_policies
  WHERE schemaname = _schema
    AND tablename = _table_name;

  IF _policy_count > 0 THEN
    RAISE NOTICE 'Skipping %.% because it already has % policy/policies', _schema, _table_name, _policy_count;
    RETURN false;
  END IF;

  _qualified := format('%I.%I', _schema, _table_name);

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', _qualified);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', _qualified);

  EXECUTE format(
    'CREATE POLICY starter_internal_select ON %s FOR SELECT TO authenticated USING (public.is_internal_tenant_member(auth.uid(), %I))',
    _qualified,
    _tenant_column
  );

  EXECUTE format(
    'CREATE POLICY starter_owner_or_manager_insert ON %s FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), %I) AND public.get_tenant_member_role(auth.uid(), %I) = ANY (ARRAY[''owner'',''booking_manager'']))',
    _qualified,
    _tenant_column,
    _tenant_column
  );

  EXECUTE format(
    'CREATE POLICY starter_owner_or_manager_update ON %s FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), %I) AND public.get_tenant_member_role(auth.uid(), %I) = ANY (ARRAY[''owner'',''booking_manager''])) WITH CHECK (public.is_tenant_member(auth.uid(), %I) AND public.get_tenant_member_role(auth.uid(), %I) = ANY (ARRAY[''owner'',''booking_manager'']))',
    _qualified,
    _tenant_column,
    _tenant_column,
    _tenant_column,
    _tenant_column
  );

  EXECUTE format(
    'CREATE POLICY starter_owner_or_manager_delete ON %s FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), %I) AND public.get_tenant_member_role(auth.uid(), %I) = ANY (ARRAY[''owner'',''booking_manager'']))',
    _qualified,
    _tenant_column,
    _tenant_column
  );

  RETURN true;
END
$$;

COMMIT;
