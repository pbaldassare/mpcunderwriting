-- Note nel PDF e data invio sulle distinte restituzione originali

ALTER TABLE public.distinte_restituzione_originali
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS data_invio timestamptz;

UPDATE public.distinte_restituzione_originali
SET data_invio = created_at
WHERE data_invio IS NULL;
