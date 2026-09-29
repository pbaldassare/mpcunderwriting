-- Vincoli integrità quote coassicurazione su dettaglio_riparto

ALTER TABLE public.dettaglio_riparto
  DROP CONSTRAINT IF EXISTS dettaglio_riparto_quota_percentuale_range;

ALTER TABLE public.dettaglio_riparto
  ADD CONSTRAINT dettaglio_riparto_quota_percentuale_range
  CHECK (quota_percentuale >= 0 AND quota_percentuale <= 100);

CREATE OR REPLACE FUNCTION public.check_dettaglio_riparto_quota_sum()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_titolo_id uuid;
  v_coass boolean;
  v_sum numeric;
BEGIN
  v_titolo_id := COALESCE(NEW.titolo_id, OLD.titolo_id);

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.quota_percentuale IS NOT NULL THEN
    IF NEW.quota_percentuale < 0 OR NEW.quota_percentuale > 100 THEN
      RAISE EXCEPTION 'quota_percentuale deve essere tra 0 e 100 (ricevuto: %)', NEW.quota_percentuale;
    END IF;
  END IF;

  SELECT t.coassicurazione INTO v_coass
  FROM public.titoli t
  WHERE t.id = v_titolo_id;

  IF v_coass IS TRUE THEN
    SELECT COALESCE(SUM(dr.quota_percentuale), 0) INTO v_sum
    FROM public.dettaglio_riparto dr
    WHERE dr.titolo_id = v_titolo_id;

    IF ABS(v_sum - 100) > 0.01 THEN
      RAISE EXCEPTION
        'Somma quote coassicurazione per titolo % deve essere 100%% (attuale: %%)',
        v_titolo_id,
        v_sum;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dettaglio_riparto_quota_sum ON public.dettaglio_riparto;

CREATE CONSTRAINT TRIGGER trg_dettaglio_riparto_quota_sum
  AFTER INSERT OR UPDATE OR DELETE ON public.dettaglio_riparto
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_dettaglio_riparto_quota_sum();

COMMENT ON FUNCTION public.check_dettaglio_riparto_quota_sum() IS
  'Verifica quota 0-100 per riga e somma 100% su titoli con coassicurazione=true.';
