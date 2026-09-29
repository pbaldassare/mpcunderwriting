-- Incassi (v_portafoglio_quietanze, security_invoker) fa JOIN su polizze.
-- Senza policy autenticati su polizze, la lista quietanze risulta vuota
-- anche se quietanze/titoli sono leggibili (bonifici aperti restano visibili).

DROP POLICY IF EXISTS "Authenticated full access polizze" ON public.polizze;
CREATE POLICY "Authenticated full access polizze" ON public.polizze
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
