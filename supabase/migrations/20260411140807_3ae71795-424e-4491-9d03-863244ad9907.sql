
CREATE OR REPLACE FUNCTION public.validate_chat_canali_ambito()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ambito NOT IN ('interno', 'contestuale') THEN
    RAISE EXCEPTION 'Invalid ambito: %', NEW.ambito;
  END IF;
  IF NEW.ambito = 'contestuale' AND NEW.entita_tipo IS NULL THEN
    RAISE EXCEPTION 'entita_tipo is required for contextual channels';
  END IF;
  IF NEW.entita_tipo IS NOT NULL AND NEW.entita_tipo NOT IN ('cliente', 'trattativa', 'titolo', 'sinistro', 'argomento', 'prospect') THEN
    RAISE EXCEPTION 'Invalid entita_tipo: %', NEW.entita_tipo;
  END IF;
  RETURN NEW;
END;
$function$;
