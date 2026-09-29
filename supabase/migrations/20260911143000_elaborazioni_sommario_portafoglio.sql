-- Elaborazione multi-polizza collegata al template sommario del cliente
ALTER TABLE public.elaborazioni
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'singola',
  ADD COLUMN IF NOT EXISTS titolo_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.elaborazioni DROP CONSTRAINT IF EXISTS elaborazioni_tipo_chk;
ALTER TABLE public.elaborazioni
  ADD CONSTRAINT elaborazioni_tipo_chk CHECK (tipo IN ('singola', 'sommario_portafoglio'));

COMMENT ON COLUMN public.elaborazioni.tipo IS
  'singola = una polizza/template ramo; sommario_portafoglio = più polizze sul template cliente';
COMMENT ON COLUMN public.elaborazioni.titolo_ids IS
  'Polizze incluse nell''elaborato di portafoglio';

UPDATE public.elaborazioni
SET titolo_ids = ARRAY[titolo_id]
WHERE titolo_id IS NOT NULL
  AND (titolo_ids IS NULL OR cardinality(titolo_ids) = 0);
