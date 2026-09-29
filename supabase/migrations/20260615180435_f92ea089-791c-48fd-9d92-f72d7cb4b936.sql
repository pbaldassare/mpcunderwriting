
-- Helper: scope child tables (polizza_cga_premio_garanzia, polizza_garanzie_personali) to parent polizza_cga access

DROP POLICY IF EXISTS "Read premio garanzia via polizza_cga" ON public.polizza_cga_premio_garanzia;
DROP POLICY IF EXISTS "Write premio garanzia via polizza_cga" ON public.polizza_cga_premio_garanzia;

CREATE POLICY "polizza_cga_premio_garanzia_read"
ON public.polizza_cga_premio_garanzia
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_cga_premio_garanzia.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
      OR pc.cliente_id IN (SELECT public.get_my_cliente_ids())
    )
));

CREATE POLICY "polizza_cga_premio_garanzia_write"
ON public.polizza_cga_premio_garanzia
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_cga_premio_garanzia.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_cga_premio_garanzia.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
    )
));

DROP POLICY IF EXISTS "polizza_garanzie_personali_read" ON public.polizza_garanzie_personali;
DROP POLICY IF EXISTS "polizza_garanzie_personali_write" ON public.polizza_garanzie_personali;

CREATE POLICY "polizza_garanzie_personali_read"
ON public.polizza_garanzie_personali
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_garanzie_personali.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
      OR pc.cliente_id IN (SELECT public.get_my_cliente_ids())
    )
));

CREATE POLICY "polizza_garanzie_personali_write"
ON public.polizza_garanzie_personali
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_garanzie_personali.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polizza_cga pc
  WHERE pc.id = polizza_garanzie_personali.polizza_cga_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clienti c
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = pc.cliente_id
          AND p.ufficio_id IS NOT NULL
          AND c.ufficio_id = p.ufficio_id
      )
    )
));
