
-- Fix: Hide materialized view from API
ALTER MATERIALIZED VIEW public.cfo_kpi_mensili SET SCHEMA extensions;
-- Move back to public but revoke access
ALTER MATERIALIZED VIEW extensions.cfo_kpi_mensili SET SCHEMA public;
REVOKE ALL ON public.cfo_kpi_mensili FROM anon, authenticated;
GRANT SELECT ON public.cfo_kpi_mensili TO authenticated;

-- Fix: Make performance_log INSERT policy check authenticated user
DROP POLICY IF EXISTS "Authenticated insert perf log" ON public.performance_log;
CREATE POLICY "Authenticated insert perf log"
  ON public.performance_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
