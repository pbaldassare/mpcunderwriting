ALTER TABLE public.rimessa_premi
  DROP CONSTRAINT IF EXISTS rimessa_premi_conto_bancario_mittente_id_fkey;

ALTER TABLE public.rimessa_premi
  ADD CONSTRAINT rimessa_premi_conto_bancario_mittente_id_fkey
  FOREIGN KEY (conto_bancario_mittente_id)
  REFERENCES public.conti_bancari(id)
  ON DELETE SET NULL;