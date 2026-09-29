-- Trigger: Sede (ufficio_id) obbligatoria per ruoli professionali
CREATE OR REPLACE FUNCTION public.validate_profilo_sede_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ruolo IN ('backoffice','account_executive','corrispondente_1','corrispondente_2','corrispondente_3','responsabile_sede')
     AND NEW.ufficio_id IS NULL THEN
    RAISE EXCEPTION 'Sede obbligatoria per il ruolo %: assegna una Sede in Anagrafiche Amministrative', NEW.ruolo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profilo_sede_required ON public.profiles;
CREATE TRIGGER trg_validate_profilo_sede_required
BEFORE INSERT OR UPDATE OF ufficio_id, ruolo ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profilo_sede_required();