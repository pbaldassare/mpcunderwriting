
-- Add INSERT/UPDATE/DELETE policies for 'ufficio' role on titoli
CREATE POLICY "Ufficio insert own titoli"
ON public.titoli
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ufficio')
  AND ufficio_id = public.get_my_ufficio_id()
);

CREATE POLICY "Ufficio update own titoli"
ON public.titoli
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ufficio')
  AND ufficio_id = public.get_my_ufficio_id()
);

CREATE POLICY "Ufficio delete own titoli"
ON public.titoli
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ufficio')
  AND ufficio_id = public.get_my_ufficio_id()
);
