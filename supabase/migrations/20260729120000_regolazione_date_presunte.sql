-- Date presunte regolazione premio (multi-anno / poliennale)
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS regolazione_date_presunte date[];

-- Backfill: singola data storica → array
UPDATE public.titoli
SET regolazione_date_presunte = ARRAY[regolazione_data_presunta]
WHERE regolazione_data_presunta IS NOT NULL
  AND (regolazione_date_presunte IS NULL OR cardinality(regolazione_date_presunte) = 0);

-- Mantieni regolazione_data_presunta = prima data dell'array (compat indici/filtri)
CREATE OR REPLACE FUNCTION public.sync_regolazione_data_presunta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.regolazione_date_presunte IS NOT NULL
     AND cardinality(NEW.regolazione_date_presunte) > 0 THEN
    NEW.regolazione_data_presunta := NEW.regolazione_date_presunte[1];
  ELSIF NEW.regolazione_date_presunte IS NOT NULL
        AND cardinality(NEW.regolazione_date_presunte) = 0 THEN
    NEW.regolazione_data_presunta := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_regolazione_data_presunta ON public.titoli;
CREATE TRIGGER trg_sync_regolazione_data_presunta
  BEFORE INSERT OR UPDATE OF regolazione_date_presunte
  ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_regolazione_data_presunta();

COMMENT ON COLUMN public.titoli.regolazione_date_presunte IS
  'Date presunte regolazione premio (una per anno di durata); regolazione_data_presunta resta la prima per compatibilità.';
