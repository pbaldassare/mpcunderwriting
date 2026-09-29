-- Consente alle sedi (ufficio/backoffice/contabilità) di creare carichi/scarti
-- solo sui conti collegati via conti_bancari_uffici. Admin/CFO restano globali.

DROP POLICY IF EXISTS "mb_carichi_insert" ON public.movimenti_bancari_carichi;
CREATE POLICY "mb_carichi_insert" ON public.movimenti_bancari_carichi
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari_carichi.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mb_carichi_update" ON public.movimenti_bancari_carichi;
CREATE POLICY "mb_carichi_update" ON public.movimenti_bancari_carichi
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari_carichi.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari_carichi.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mb_carichi_scarti_insert" ON public.movimenti_bancari_carichi_scarti;
CREATE POLICY "mb_carichi_scarti_insert" ON public.movimenti_bancari_carichi_scarti
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.movimenti_bancari_carichi c
      WHERE c.id = movimenti_bancari_carichi_scarti.carico_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'cfo'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = c.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );

COMMENT ON POLICY "mb_carichi_insert" ON public.movimenti_bancari_carichi IS
  'Admin/CFO ovunque; sede solo su conti collegati in conti_bancari_uffici.';
