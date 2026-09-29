DROP POLICY IF EXISTS polizza_cga_read_via_cliente ON public.polizza_cga;
CREATE POLICY polizza_cga_read_via_cliente ON public.polizza_cga
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.clienti c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND p.ufficio_id IS NOT NULL
      AND c.ufficio_id = p.ufficio_id
  )
  OR cliente_id IN (SELECT public.get_my_cliente_ids())
);