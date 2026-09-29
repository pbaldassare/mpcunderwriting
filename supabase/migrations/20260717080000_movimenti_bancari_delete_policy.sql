-- Consentire DELETE movimenti bancari a admin/cfo (UI Monitor)

DROP POLICY IF EXISTS "mb_admin_delete" ON public.movimenti_bancari;
CREATE POLICY "mb_admin_delete" ON public.movimenti_bancari
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
  );

COMMENT ON POLICY "mb_admin_delete" ON public.movimenti_bancari IS
  'Solo admin/cfo possono cancellare movimenti; la UI limita agli stati aperti e logga in log_attivita.';
