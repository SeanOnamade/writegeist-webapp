-- Fix Supabase Security Advisor "Function Search Path Mutable" warnings.
-- Functions without a fixed search_path are vulnerable to search-path hijacking.
-- Using "public, extensions" covers regular functions and pgvector operators (<=>).
-- Skips extension-owned functions (e.g. pgvector halfvec_*) that cannot be altered.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      -- Exclude functions installed by extensions (pgvector, etc.)
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend d
        JOIN pg_catalog.pg_extension e ON e.oid = d.refobjid
        WHERE d.classid = 'pg_catalog.pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.func_sig);
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped % (not owner)', r.func_sig;
    END;
  END LOOP;
END;
$$;
