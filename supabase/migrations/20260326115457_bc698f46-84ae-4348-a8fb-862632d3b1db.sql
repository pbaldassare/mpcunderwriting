CREATE OR REPLACE FUNCTION public.count_polizze_per_cliente()
RETURNS TABLE(cliente_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT cliente_anagrafica_id, COUNT(*) 
  FROM titoli 
  WHERE cliente_anagrafica_id IS NOT NULL
  GROUP BY cliente_anagrafica_id
$$;