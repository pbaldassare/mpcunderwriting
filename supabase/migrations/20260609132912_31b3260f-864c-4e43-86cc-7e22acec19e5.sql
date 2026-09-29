-- Cleanup: rimuovi rapporti N:N che puntano ad agenzie dello stesso gruppo principale
DELETE FROM public.compagnia_rapporti cr
USING public.compagnie c
WHERE c.id = cr.compagnia_id
  AND c.gruppo_compagnia_id IS NOT NULL
  AND c.gruppo_compagnia_id = cr.gruppo_compagnia_id;

-- Trigger di prevenzione
CREATE OR REPLACE FUNCTION public.trg_block_self_referential_rapporto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gruppo uuid;
BEGIN
  IF NEW.compagnia_id IS NULL OR NEW.gruppo_compagnia_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT gruppo_compagnia_id INTO v_gruppo FROM public.compagnie WHERE id = NEW.compagnia_id;
  IF v_gruppo IS NOT NULL AND v_gruppo = NEW.gruppo_compagnia_id THEN
    RAISE EXCEPTION 'Un''agenzia non può avere un rapporto N:N con la propria Compagnia di appartenenza';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compagnia_rapporti_no_self ON public.compagnia_rapporti;
CREATE TRIGGER trg_compagnia_rapporti_no_self
BEFORE INSERT OR UPDATE ON public.compagnia_rapporti
FOR EACH ROW EXECUTE FUNCTION public.trg_block_self_referential_rapporto();