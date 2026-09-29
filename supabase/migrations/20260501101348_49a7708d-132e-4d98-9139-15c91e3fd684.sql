-- Garantisce unicità (canale_id, user_id) su chat_canali_membri per consentire upsert sicuri
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_canali_membri_canale_user_unique'
      AND conrelid = 'public.chat_canali_membri'::regclass
  ) THEN
    -- Rimuove eventuali duplicati pre-esistenti tenendo il primo
    DELETE FROM public.chat_canali_membri a
    USING public.chat_canali_membri b
    WHERE a.ctid > b.ctid
      AND a.canale_id = b.canale_id
      AND a.user_id = b.user_id;

    ALTER TABLE public.chat_canali_membri
      ADD CONSTRAINT chat_canali_membri_canale_user_unique UNIQUE (canale_id, user_id);
  END IF;
END $$;