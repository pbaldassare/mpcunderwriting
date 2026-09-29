-- Staff (ufficio/backoffice/produttore/…) could insert documenti rows but had no
-- storage.objects policy on bucket documenti_sinistri after removal of the broad
-- "Authenticated upload" policy (20260511183650). Only admin and cliente could upload.

DROP POLICY IF EXISTS "Staff write documenti_sinistri" ON storage.objects;
CREATE POLICY "Staff write documenti_sinistri" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documenti_sinistri'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ufficio'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
      OR public.has_role(auth.uid(), 'contabilita'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR public.has_role(auth.uid(), 'produttore'::app_role)
      OR public.has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

DROP POLICY IF EXISTS "Staff read documenti_sinistri" ON storage.objects;
CREATE POLICY "Staff read documenti_sinistri" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documenti_sinistri'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ufficio'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
      OR public.has_role(auth.uid(), 'contabilita'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR public.has_role(auth.uid(), 'produttore'::app_role)
      OR public.has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

DROP POLICY IF EXISTS "Staff delete documenti_sinistri" ON storage.objects;
CREATE POLICY "Staff delete documenti_sinistri" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documenti_sinistri'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ufficio'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
      OR public.has_role(auth.uid(), 'contabilita'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
      OR public.has_role(auth.uid(), 'produttore'::app_role)
      OR public.has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );
