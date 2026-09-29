ALTER TABLE public.uffici
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS intestato_a text,
  ADD COLUMN IF NOT EXISTS banca text;