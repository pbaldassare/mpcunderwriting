CREATE OR REPLACE FUNCTION public.ai_describe_table(table_name text)
RETURNS TABLE(column_name text, data_type text, is_nullable text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = ai_describe_table.table_name
  ORDER BY c.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.ai_describe_table(text) TO authenticated;