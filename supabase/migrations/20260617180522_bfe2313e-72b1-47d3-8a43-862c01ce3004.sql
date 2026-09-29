
-- SELECT
CREATE POLICY "Staff select appendici_polizza"
ON public.appendici_polizza FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

-- INSERT
CREATE POLICY "Staff insert appendici_polizza"
ON public.appendici_polizza FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

-- UPDATE
CREATE POLICY "Staff update appendici_polizza"
ON public.appendici_polizza FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

-- DELETE
CREATE POLICY "Staff delete appendici_polizza"
ON public.appendici_polizza FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);
