CREATE OR REPLACE FUNCTION public.get_rapporti_counts_per_compagnia()
RETURNS TABLE (compagnia_id uuid, tot bigint, attivi bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    compagnia_id,
    COUNT(*)::bigint AS tot,
    COUNT(*) FILTER (WHERE attivo)::bigint AS attivi
  FROM public.compagnia_rapporti
  GROUP BY compagnia_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_rapporti_counts_per_compagnia() TO authenticated;