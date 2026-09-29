-- Trigger anti-doppio-incasso su titoli
-- Blocca la rivalorizzazione di data_messa_cassa quando è già impostata,
-- a meno che la polizza sia poliennale attiva (rate residue legittime)
-- oppure sia un admin che usa il bypass session setting (stesso meccanismo di lock_premi_storici).

CREATE OR REPLACE FUNCTION public.prevent_double_messa_cassa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
  v_months int;
  v_is_poliennale boolean := false;
BEGIN
  -- Bypass admin (stessa convenzione di lock_premi_storici)
  v_bypass := current_setting('app.bypass_messa_cassa_lock', true);
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Caso 1: data_messa_cassa già valorizzata in OLD e cambiata/rimessa in NEW
  IF OLD.data_messa_cassa IS NOT NULL
     AND NEW.data_messa_cassa IS NOT NULL
     AND NEW.data_messa_cassa IS DISTINCT FROM OLD.data_messa_cassa THEN

    -- Eccezione: poliennale ancora attiva (rata successiva)
    IF NEW.garanzia_da IS NOT NULL AND NEW.garanzia_a IS NOT NULL THEN
      v_months := (EXTRACT(YEAR FROM NEW.garanzia_a) - EXTRACT(YEAR FROM NEW.garanzia_da)) * 12
                + (EXTRACT(MONTH FROM NEW.garanzia_a) - EXTRACT(MONTH FROM NEW.garanzia_da));
      v_is_poliennale := v_months > 13;
    END IF;

    IF NOT (v_is_poliennale AND NEW.stato = 'attivo') THEN
      RAISE EXCEPTION 'Polizza % già messa a cassa il %. Impossibile incassare di nuovo (annulla prima la messa a cassa precedente).',
        COALESCE(NEW.numero_titolo, NEW.id::text), OLD.data_messa_cassa;
    END IF;
  END IF;

  -- Caso 2: stato già 'incassato' e si tenta di reincassare senza prima annullare
  IF OLD.stato = 'incassato'
     AND NEW.stato = 'incassato'
     AND OLD.data_incasso IS NOT NULL
     AND NEW.data_incasso IS NOT NULL
     AND NEW.data_incasso IS DISTINCT FROM OLD.data_incasso THEN

    IF NEW.garanzia_da IS NOT NULL AND NEW.garanzia_a IS NOT NULL THEN
      v_months := (EXTRACT(YEAR FROM NEW.garanzia_a) - EXTRACT(YEAR FROM NEW.garanzia_da)) * 12
                + (EXTRACT(MONTH FROM NEW.garanzia_a) - EXTRACT(MONTH FROM NEW.garanzia_da));
      v_is_poliennale := v_months > 13;
    END IF;

    IF NOT v_is_poliennale THEN
      RAISE EXCEPTION 'Polizza % già incassata il %. Annulla prima l''incasso precedente.',
        COALESCE(NEW.numero_titolo, NEW.id::text), OLD.data_incasso;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_double_messa_cassa ON public.titoli;
CREATE TRIGGER trg_prevent_double_messa_cassa
  BEFORE UPDATE ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_double_messa_cassa();