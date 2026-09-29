CREATE POLICY "Chat participants visible to each other"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_canali_membri m1
    JOIN public.chat_canali_membri m2 ON m2.canale_id = m1.canale_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
  )
);