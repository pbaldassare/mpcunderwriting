-- Persistenza note interne operatore su sinistro (prima solo in evento timeline)
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS note_interne text;

COMMENT ON COLUMN public.sinistri.note_interne IS 'Note interne staff, non visibili al cliente';
