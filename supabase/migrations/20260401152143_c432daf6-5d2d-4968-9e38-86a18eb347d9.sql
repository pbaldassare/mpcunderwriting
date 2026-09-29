CREATE POLICY "Cliente select compagnie"
ON public.compagnie FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cliente'));

CREATE POLICY "Cliente select rami"
ON public.rami FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cliente'));