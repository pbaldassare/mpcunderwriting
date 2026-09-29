ALTER TABLE public.compagnie_snapshot_post_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo admin e responsabile_sede leggono snapshot compagnie"
ON public.compagnie_snapshot_post_dedup
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin','responsabile_sede')
  )
);