CREATE OR REPLACE FUNCTION public.trg_block_self_referential_rapporto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gruppo uuid;
BEGIN
  -- Il rapporto principale (1:1 con la Compagnia madre) è legittimo: skip
  IF COALESCE(NEW.is_principale, false) = true THEN
    RETURN NEW;
  END IF;
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