-- Distinzione conversazioni: mercato web vs libreria CGA

ALTER TABLE public.garanzie_chat_conversazioni
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'cga'
    CHECK (tipo IN ('web', 'cga'));

CREATE INDEX IF NOT EXISTS idx_garanzie_chat_conv_tipo
  ON public.garanzie_chat_conversazioni(tipo, updated_at DESC);

COMMENT ON COLUMN public.garanzie_chat_conversazioni.tipo IS
  'web = chat ricerca mercato assicurativo su internet; cga = chat Libreria CGA interna';
