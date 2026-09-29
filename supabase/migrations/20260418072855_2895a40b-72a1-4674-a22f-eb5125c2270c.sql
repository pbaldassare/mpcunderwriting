-- Allow channel creators to see their channels even before becoming a member
-- Fixes "new row violates row-level security" error on INSERT...SELECT roundtrip
DROP POLICY IF EXISTS "Users see channels they belong to" ON public.chat_canali;

CREATE POLICY "Users see channels they belong to or created"
ON public.chat_canali
FOR SELECT
TO authenticated
USING (
  creato_da = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_canali_membri
    WHERE chat_canali_membri.canale_id = chat_canali.id
      AND chat_canali_membri.user_id = auth.uid()
  )
);