-- Add area_riservata_tipo column
ALTER TABLE public.clienti ADD COLUMN area_riservata_tipo text NOT NULL DEFAULT 'nessuna';

-- Set existing provisioned clients to sola_lettura
UPDATE public.clienti SET area_riservata_tipo = 'sola_lettura' WHERE user_id IS NOT NULL;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_area_riservata_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.area_riservata_tipo NOT IN ('nessuna', 'sola_lettura', 'completa') THEN
    RAISE EXCEPTION 'Invalid area_riservata_tipo: %', NEW.area_riservata_tipo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_area_riservata_tipo
BEFORE INSERT OR UPDATE ON public.clienti
FOR EACH ROW
EXECUTE FUNCTION public.validate_area_riservata_tipo();