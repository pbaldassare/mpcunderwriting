-- L'insert era solo per ruolo ufficio: admin/cfo/backoffice non potevano salvare la nidificazione.
DROP POLICY IF EXISTS "Staff insert clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Staff update clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Staff delete clienti_relazioni" ON public.clienti_relazioni;

CREATE POLICY "Staff insert clienti_relazioni"
ON public.clienti_relazioni FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);

CREATE POLICY "Staff update clienti_relazioni"
ON public.clienti_relazioni FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);

CREATE POLICY "Staff delete clienti_relazioni"
ON public.clienti_relazioni FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);
