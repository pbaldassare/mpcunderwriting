-- Function to execute read-only SELECT queries on behalf of the AI assistant.
-- SECURITY INVOKER ensures RLS is applied as the calling user.
CREATE OR REPLACE FUNCTION public.ai_exec_select(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
  forbidden TEXT;
  trimmed TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  trimmed := TRIM(query_text);

  -- Must start with SELECT or WITH
  IF NOT (trimmed ~* '^(SELECT|WITH)\s') THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed';
  END IF;

  -- Block dangerous keywords (word-boundary match)
  FOR forbidden IN SELECT unnest(ARRAY[
    'INSERT','UPDATE','DELETE','DROP','ALTER','CREATE','GRANT','REVOKE',
    'TRUNCATE','MERGE','CALL','COPY','VACUUM','ANALYZE','REINDEX',
    'COMMENT','SECURITY DEFINER','pg_sleep','SET ROLE','RESET ROLE'
  ])
  LOOP
    IF trimmed ~* ('\m' || forbidden || '\M') THEN
      RAISE EXCEPTION 'Forbidden keyword: %', forbidden;
    END IF;
  END LOOP;

  -- Block multiple statements
  IF position(';' IN rtrim(trimmed, ';')) > 0 THEN
    RAISE EXCEPTION 'Multiple statements not allowed';
  END IF;

  -- Execute and aggregate as JSON
  EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', rtrim(trimmed, ';'))
    INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_exec_select(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_exec_select(TEXT) TO authenticated;