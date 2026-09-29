-- Fix: la policy Admin ALL su titoli/movimenti_polizza non aveva WITH CHECK,
-- quindi gli INSERT da admin venivano rifiutati.

DROP POLICY IF EXISTS "Admin all titoli" ON public.titoli;
CREATE POLICY "Admin all titoli"
  ON public.titoli
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin full access on movimenti_polizza" ON public.movimenti_polizza;
CREATE POLICY "Admin full access on movimenti_polizza"
  ON public.movimenti_polizza
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));