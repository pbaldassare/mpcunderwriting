-- Visibilità commerciale dei bandi: nuovo vs già visto.
-- Non confondere con bandi_pubblici.stato (stato gara) né con bandi_interesse.esito (decisione).

ALTER TABLE public.bandi_pubblici
  ADD COLUMN IF NOT EXISTS last_harvest_at timestamptz,
  ADD COLUMN IF NOT EXISTS visto_il timestamptz,
  ADD COLUMN IF NOT EXISTS visto_da uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.bandi_pubblici
SET last_harvest_at = COALESCE(last_harvest_at, updated_at, created_at)
WHERE last_harvest_at IS NULL;

CREATE INDEX IF NOT EXISTS bandi_pubblici_visto_il_idx
  ON public.bandi_pubblici (visto_il);

CREATE INDEX IF NOT EXISTS bandi_pubblici_last_harvest_idx
  ON public.bandi_pubblici (last_harvest_at DESC);

COMMENT ON COLUMN public.bandi_pubblici.last_harvest_at IS
  'Ultima ricerca in cui il bando è ricomparso. created_at resta la prima volta in CBnet.';
COMMENT ON COLUMN public.bandi_pubblici.visto_il IS
  'Prima apertura in UI. NULL = ancora nuovo (mai aperto).';
COMMENT ON COLUMN public.bandi_pubblici.visto_da IS
  'Utente che ha aperto il bando la prima volta.';
