-- Sedi non-admin: gestiscono solo template e branding della propria sede.
-- I template/branding globali (ufficio_id NULL) restano in sola lettura per le sedi.

DROP POLICY IF EXISTS "Admin can manage template_email" ON public.template_email;
DROP POLICY IF EXISTS "Authenticated users can read template_email" ON public.template_email;
DROP POLICY IF EXISTS "Read template_email scoped" ON public.template_email;
DROP POLICY IF EXISTS "Sede can manage own template_email" ON public.template_email;

CREATE POLICY "Read template_email scoped"
  ON public.template_email FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
    OR ufficio_id IS NULL
    OR ufficio_id = public.get_my_ufficio_id()
  );

CREATE POLICY "Admin can manage template_email"
  ON public.template_email FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  );

CREATE POLICY "Sede can manage own template_email"
  ON public.template_email FOR ALL TO authenticated
  USING (
    ufficio_id IS NOT NULL
    AND ufficio_id = public.get_my_ufficio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
    )
  )
  WITH CHECK (
    ufficio_id IS NOT NULL
    AND ufficio_id = public.get_my_ufficio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
    )
  );

DROP POLICY IF EXISTS "Admins can insert email_branding" ON public.email_branding;
DROP POLICY IF EXISTS "Admins can update email_branding" ON public.email_branding;
DROP POLICY IF EXISTS "Admins can delete email_branding" ON public.email_branding;
DROP POLICY IF EXISTS "Sede can insert own email_branding" ON public.email_branding;
DROP POLICY IF EXISTS "Sede can update own email_branding" ON public.email_branding;
DROP POLICY IF EXISTS "Sede can delete own email_branding" ON public.email_branding;

CREATE POLICY "Admins can insert email_branding"
  ON public.email_branding FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  );

CREATE POLICY "Admins can update email_branding"
  ON public.email_branding FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  );

CREATE POLICY "Admins can delete email_branding"
  ON public.email_branding FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  );

CREATE POLICY "Sede can insert own email_branding"
  ON public.email_branding FOR INSERT TO authenticated
  WITH CHECK (
    ufficio_id IS NOT NULL
    AND ufficio_id = public.get_my_ufficio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
    )
  );

CREATE POLICY "Sede can update own email_branding"
  ON public.email_branding FOR UPDATE TO authenticated
  USING (
    ufficio_id IS NOT NULL
    AND ufficio_id = public.get_my_ufficio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
    )
  );

CREATE POLICY "Sede can delete own email_branding"
  ON public.email_branding FOR DELETE TO authenticated
  USING (
    ufficio_id IS NOT NULL
    AND ufficio_id = public.get_my_ufficio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
    )
  );

DROP POLICY IF EXISTS "Sede can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Sede can update branding files" ON storage.objects;

CREATE POLICY "Sede can upload branding files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
        AND p.ufficio_id IS NOT NULL
    )
  );

CREATE POLICY "Sede can update branding files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('ufficio', 'backoffice', 'contabilita', 'responsabile_sede')
        AND p.ufficio_id IS NOT NULL
    )
  );
