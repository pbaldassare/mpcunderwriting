-- Dual source of truth: user_roles (has_role) OR profiles.ruolo.
-- Un admin presente solo in profiles non poteva scrivere su clienti_relazioni.

DROP POLICY IF EXISTS "Staff insert clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Staff update clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Staff delete clienti_relazioni" ON public.clienti_relazioni;

CREATE POLICY "Staff insert clienti_relazioni"
ON public.clienti_relazioni
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'cfo')
  OR public.has_role(auth.uid(), 'ufficio')
  OR public.has_role(auth.uid(), 'backoffice')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice')
  )
);

CREATE POLICY "Staff update clienti_relazioni"
ON public.clienti_relazioni
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'cfo')
  OR public.has_role(auth.uid(), 'ufficio')
  OR public.has_role(auth.uid(), 'backoffice')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice')
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'cfo')
  OR public.has_role(auth.uid(), 'ufficio')
  OR public.has_role(auth.uid(), 'backoffice')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice')
  )
);

CREATE POLICY "Staff delete clienti_relazioni"
ON public.clienti_relazioni
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'cfo')
  OR public.has_role(auth.uid(), 'ufficio')
  OR public.has_role(auth.uid(), 'backoffice')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice')
  )
);
