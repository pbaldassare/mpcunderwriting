ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS regolazione_data_presunta DATE,
  ADD COLUMN IF NOT EXISTS regolazione_fattore TEXT,
  ADD COLUMN IF NOT EXISTS regolazione_note TEXT;

ALTER TABLE public.titoli
  DROP CONSTRAINT IF EXISTS chk_titoli_regolazione_fattore;
ALTER TABLE public.titoli
  ADD CONSTRAINT chk_titoli_regolazione_fattore
  CHECK (regolazione_fattore IS NULL OR regolazione_fattore IN ('fatturato','num_dipendenti','retribuzioni','altro'));

CREATE INDEX IF NOT EXISTS idx_titoli_regolazione_flag
  ON public.titoli(regolazione_data_presunta)
  WHERE regolazione = true;