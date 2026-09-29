-- Produttori che incassano e trattengono la provvigione alla fonte (al netto RA).
ALTER TABLE IF EXISTS public.anagrafiche_professionali
  ADD COLUMN IF NOT EXISTS trattenuta_provvigioni_incasso boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.anagrafiche_professionali.trattenuta_provvigioni_incasso IS
  'Se true, il produttore principale trattiene la provvigione in incasso; importo_incassato = premio - provv + RA; provvigioni_generate pagata subito.';
