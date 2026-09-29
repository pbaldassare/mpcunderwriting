ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS ae_anagrafica_id uuid REFERENCES public.anagrafiche_professionali(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_ae_anagrafica_id ON public.titoli(ae_anagrafica_id);

ALTER TABLE public.codici_commerciali_cliente
  ADD COLUMN IF NOT EXISTS anagrafica_id uuid REFERENCES public.anagrafiche_professionali(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ccc_anagrafica_id ON public.codici_commerciali_cliente(anagrafica_id);