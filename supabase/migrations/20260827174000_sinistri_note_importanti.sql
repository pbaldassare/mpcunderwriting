-- Note importanti visibili in scheda sinistro (sezione Descrizione e luogo)
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS note_importanti text;

COMMENT ON COLUMN public.sinistri.note_importanti IS 'Note importanti sulla pratica sinistro (sezione Descrizione e luogo)';
