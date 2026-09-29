-- CIG temporaneo: progressivo CIG0001, CIG0002, …

CREATE SEQUENCE IF NOT EXISTS public.titoli_cig_temporaneo_seq;

-- Seed sequence da eventuali CIG temporanei già presenti
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(substring(cig_rif from 4)::bigint), 0)
    INTO v_max
  FROM public.titoli
  WHERE cig_rif ~ '^CIG[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.titoli_cig_temporaneo_seq', v_max, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.format_cig_temporaneo(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'CIG' || CASE
    WHEN length(p_n::text) < 4 THEN lpad(p_n::text, 4, '0')
    ELSE p_n::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.next_cig_temporaneo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;
  v_n := nextval('public.titoli_cig_temporaneo_seq');
  RETURN public.format_cig_temporaneo(v_n);
END;
$$;

GRANT USAGE, SELECT ON SEQUENCE public.titoli_cig_temporaneo_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.format_cig_temporaneo(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_cig_temporaneo() TO authenticated, service_role;
