-- Acconti e compensazioni: ogni acconto/compensazione cliente è collegato
-- a una causale contabile (compensazione_messa_cassa) e ha un segno +/-/-.
-- Importo resta sempre in valore assoluto (> 0); il segno determina credito (+) o debito (−).

-- ---------------------------------------------------------------------------
-- 1) Causali di sistema (default storico + acconto da titolo a credito)
-- ---------------------------------------------------------------------------
INSERT INTO public.causali_contabili (tipo_tabella, codice, descrizione, attivo, segno_default, effetto_contabile)
SELECT 'compensazione_messa_cassa', 'ACC_STOR', 'Acconto storico (pre-migrazione causale)', true, '+', 'standard'
WHERE NOT EXISTS (
  SELECT 1 FROM public.causali_contabili
  WHERE tipo_tabella = 'compensazione_messa_cassa' AND codice = 'ACC_STOR'
);

INSERT INTO public.causali_contabili (tipo_tabella, codice, descrizione, attivo, segno_default, effetto_contabile)
SELECT 'compensazione_messa_cassa', 'ACC_CRED', 'Acconto da titolo a credito / conguaglio', true, '+', 'eccedenza'
WHERE NOT EXISTS (
  SELECT 1 FROM public.causali_contabili
  WHERE tipo_tabella = 'compensazione_messa_cassa' AND codice = 'ACC_CRED'
);

-- ---------------------------------------------------------------------------
-- 2) Colonne su cliente_anticipi
-- ---------------------------------------------------------------------------
ALTER TABLE public.cliente_anticipi
  ADD COLUMN IF NOT EXISTS causale_id uuid REFERENCES public.causali_contabili(id),
  ADD COLUMN IF NOT EXISTS segno text;

-- Backfill segno
UPDATE public.cliente_anticipi
SET segno = '+'
WHERE segno IS NULL;

ALTER TABLE public.cliente_anticipi
  ALTER COLUMN segno SET DEFAULT '+';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cliente_anticipi_segno_check'
  ) THEN
    ALTER TABLE public.cliente_anticipi
      ADD CONSTRAINT cliente_anticipi_segno_check CHECK (segno IN ('+', '-'));
  END IF;
END $$;

ALTER TABLE public.cliente_anticipi
  ALTER COLUMN segno SET NOT NULL;

-- Backfill causale_id con ACC_STOR
UPDATE public.cliente_anticipi a
SET causale_id = c.id
FROM public.causali_contabili c
WHERE a.causale_id IS NULL
  AND c.tipo_tabella = 'compensazione_messa_cassa'
  AND c.codice = 'ACC_STOR';

-- Se per qualche motivo ACC_STOR non c'è, usa ECCED
UPDATE public.cliente_anticipi a
SET causale_id = c.id
FROM public.causali_contabili c
WHERE a.causale_id IS NULL
  AND c.tipo_tabella = 'compensazione_messa_cassa'
  AND c.codice = 'ECCED';

ALTER TABLE public.cliente_anticipi
  ALTER COLUMN causale_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_anticipi_causale
  ON public.cliente_anticipi(causale_id);

COMMENT ON COLUMN public.cliente_anticipi.causale_id IS
  'Causale contabile (compensazione_messa_cassa) obbligatoria per ogni acconto/compensazione.';
COMMENT ON COLUMN public.cliente_anticipi.segno IS
  '+ = credito cliente (utilizzabile in messa a cassa); − = partita a debito/compensazione negativa.';
