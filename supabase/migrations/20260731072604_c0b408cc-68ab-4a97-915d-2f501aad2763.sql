DROP POLICY IF EXISTS "Authenticated insert perf log" ON public.performance_log;
CREATE POLICY "Authenticated insert perf log" ON public.performance_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);