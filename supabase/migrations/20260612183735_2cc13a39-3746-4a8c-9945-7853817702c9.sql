
-- Fix polizza_cga SELECT: remove NULL ufficio bypass
DROP POLICY IF EXISTS polizza_cga_read_via_cliente ON public.polizza_cga;
CREATE POLICY polizza_cga_read_via_cliente ON public.polizza_cga
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR EXISTS (
    SELECT 1 FROM clienti c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND p.ufficio_id IS NOT NULL
      AND c.ufficio_id = p.ufficio_id
  )
);

-- Fix polizza_cga write: mirror USING in WITH CHECK
DROP POLICY IF EXISTS polizza_cga_write_via_cliente ON public.polizza_cga;
CREATE POLICY polizza_cga_write_via_cliente ON public.polizza_cga
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR EXISTS (
    SELECT 1 FROM clienti c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND p.ufficio_id IS NOT NULL
      AND c.ufficio_id = p.ufficio_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR EXISTS (
    SELECT 1 FROM clienti c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND p.ufficio_id IS NOT NULL
      AND c.ufficio_id = p.ufficio_id
  )
);

-- Restrict prodotti_* write tables to admin/cfo only; keep authenticated read
DROP POLICY IF EXISTS "Authenticated write prodotti_articoli" ON public.prodotti_articoli;
CREATE POLICY "Admin write prodotti_articoli" ON public.prodotti_articoli
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role));

DROP POLICY IF EXISTS "Authenticated write prodotti_definizioni" ON public.prodotti_definizioni;
CREATE POLICY "Admin write prodotti_definizioni" ON public.prodotti_definizioni
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role));

DROP POLICY IF EXISTS "Authenticated write prodotti_riferimenti" ON public.prodotti_riferimenti_normativi;
CREATE POLICY "Admin write prodotti_riferimenti" ON public.prodotti_riferimenti_normativi
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role));
