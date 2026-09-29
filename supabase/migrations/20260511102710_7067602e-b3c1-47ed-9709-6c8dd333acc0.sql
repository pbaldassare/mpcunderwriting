ALTER TABLE public.rca_garanzie ADD COLUMN IF NOT EXISTS gruppo_ramo_id uuid REFERENCES public.gruppi_ramo(id) ON DELETE RESTRICT;

UPDATE public.rca_garanzie
SET gruppo_ramo_id = (SELECT id FROM public.gruppi_ramo WHERE codice = 'ZQ' LIMIT 1)
WHERE gruppo_ramo_id IS NULL;

ALTER TABLE public.rca_garanzie ALTER COLUMN gruppo_ramo_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rca_garanzie_gruppo_ramo ON public.rca_garanzie(gruppo_ramo_id);