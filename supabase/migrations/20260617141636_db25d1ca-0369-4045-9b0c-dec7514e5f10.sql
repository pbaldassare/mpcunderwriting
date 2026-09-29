ALTER TABLE public.titoli_regolazioni
  ADD COLUMN IF NOT EXISTS quietanza_riferimento_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_regolazioni_quietanza_ref
  ON public.titoli_regolazioni(quietanza_riferimento_id);