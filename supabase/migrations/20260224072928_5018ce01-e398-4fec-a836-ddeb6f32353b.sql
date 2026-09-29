
-- Remove materialized view from public API exposure
REVOKE ALL ON public.cfo_kpi_aggregati FROM anon, authenticated;
-- Grant only to admin/cfo via the refresh function
GRANT SELECT ON public.cfo_kpi_aggregati TO authenticated;
