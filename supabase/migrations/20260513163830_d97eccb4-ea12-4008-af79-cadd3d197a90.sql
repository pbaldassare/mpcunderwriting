ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS compagnia_rapporto_id uuid NULL REFERENCES public.compagnia_rapporti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codice_rapporto text NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_compagnia_rapporto_id ON public.titoli(compagnia_rapporto_id);