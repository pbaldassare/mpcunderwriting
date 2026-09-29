-- Fonte TED / Mondo Appalti già usata in UI e trattative: persistenza su bandi e ricerche.
ALTER TABLE public.bandi_pubblici
  ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'ted';

ALTER TABLE public.ricerche_bandi
  ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'ted';

UPDATE public.bandi_pubblici
SET fonte = 'mondoappalti'
WHERE fonte IS DISTINCT FROM 'mondoappalti'
  AND link ILIKE '%mondoappalti.it%';

ALTER TABLE public.bandi_pubblici
  DROP CONSTRAINT IF EXISTS bandi_pubblici_fonte_check;
ALTER TABLE public.bandi_pubblici
  ADD CONSTRAINT bandi_pubblici_fonte_check
  CHECK (fonte IN ('ted', 'mondoappalti'));

ALTER TABLE public.ricerche_bandi
  DROP CONSTRAINT IF EXISTS ricerche_bandi_fonte_check;
ALTER TABLE public.ricerche_bandi
  ADD CONSTRAINT ricerche_bandi_fonte_check
  CHECK (fonte IN ('ted', 'mondoappalti', 'entrambe'));

CREATE INDEX IF NOT EXISTS idx_bandi_pubblici_fonte ON public.bandi_pubblici (fonte);
CREATE INDEX IF NOT EXISTS idx_ricerche_bandi_fonte ON public.ricerche_bandi (fonte);
