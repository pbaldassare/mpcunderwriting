
-- Move materialized view to a non-exposed schema
CREATE SCHEMA IF NOT EXISTS reporting;

-- Drop from public
DROP MATERIALIZED VIEW IF EXISTS public.cfo_kpi_aggregati;

-- Recreate in reporting schema (not exposed via API)
CREATE MATERIALIZED VIEW reporting.cfo_kpi_aggregati AS
SELECT
  COALESCE(SUM(CASE WHEN t.stato = 'incassato' THEN t.importo_incassato ELSE 0 END), 0) AS totale_premi_incassati,
  COALESCE((SELECT SUM(importo_provvigione) FROM public.provvigioni_generate), 0) AS totale_provvigioni_generate,
  COALESCE((SELECT SUM(importo_provvigione) FROM public.provvigioni_generate WHERE pagata = true), 0) AS totale_provvigioni_pagate,
  COALESCE((SELECT SUM(importo) FROM public.movimenti_contabili WHERE tipo = 'entrata'), 0) AS totale_entrate,
  COALESCE((SELECT SUM(importo) FROM public.movimenti_contabili WHERE tipo = 'uscita'), 0) AS totale_uscite,
  COALESCE((SELECT SUM(importo) FROM public.movimenti_contabili WHERE tipo = 'entrata'), 0)
    - COALESCE((SELECT SUM(importo) FROM public.movimenti_contabili WHERE tipo = 'uscita'), 0) AS totale_saldo
FROM public.titoli t;

-- Update refresh function to use reporting schema
CREATE OR REPLACE FUNCTION public.refresh_cfo_kpi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW reporting.cfo_kpi_aggregati;
END;
$$;
