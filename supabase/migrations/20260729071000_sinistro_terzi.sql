-- Sinistro Terzi: sinistri gestiti senza collegamento a polizza CBnet
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS sinistro_terzi boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sinistri.sinistro_terzi IS
  'True = Sinistro Terzi (senza polizza CBnet); implica titolo_id NULL';

-- Enforce: se terzi allora nessuna polizza collegata
ALTER TABLE public.sinistri
  DROP CONSTRAINT IF EXISTS sinistri_sinistro_terzi_titolo_check;

ALTER TABLE public.sinistri
  ADD CONSTRAINT sinistri_sinistro_terzi_titolo_check
  CHECK (
    (sinistro_terzi = false)
    OR (sinistro_terzi = true AND titolo_id IS NULL)
  );
