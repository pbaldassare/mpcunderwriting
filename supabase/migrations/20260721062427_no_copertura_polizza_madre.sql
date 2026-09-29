-- Regola di dominio: la polizza madre NON ha data_copertura.
-- Copertura/incasso solo su quietanze e appendici. Eventuali valori sulla madre
-- sono residui errati (es. quietanza cancellata) e vanno azzerati / bloccati.

-- 1) Pulizia dati esistenti sulle madri
UPDATE public.titoli t
SET
  data_copertura = NULL,
  conferimento_gestito = CASE
    WHEN t.data_messa_cassa IS NULL AND COALESCE(t.conferimento_gestito, false) = true
      THEN false
    ELSE t.conferimento_gestito
  END,
  data_conferimento_gestito = CASE
    WHEN t.data_messa_cassa IS NULL AND COALESCE(t.conferimento_gestito, false) = true
      THEN NULL
    ELSE t.data_conferimento_gestito
  END,
  tipo_pagamento = CASE
    WHEN t.data_messa_cassa IS NULL
         AND COALESCE(t.conferimento_gestito, false) = true
         AND t.tipo_pagamento = 'garantito'
      THEN NULL
    ELSE t.tipo_pagamento
  END,
  updated_at = now()
WHERE t.sostituisce_polizza IS NULL
  AND COALESCE(t.is_appendice_modifica, false) = false
  AND COALESCE(t.is_proroga, false) = false
  AND COALESCE(t.is_regolazione, false) = false
  AND (
    t.data_copertura IS NOT NULL
    OR (
      t.data_messa_cassa IS NULL
      AND COALESCE(t.conferimento_gestito, false) = true
    )
  );

-- 2) Helper: azzera copertura sulla madre collegata a un titolo (o sulla madre stessa)
CREATE OR REPLACE FUNCTION public.clear_data_copertura_polizza_madre(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_madre_id uuid;
BEGIN
  SELECT id, numero_titolo, sostituisce_polizza,
         is_appendice_modifica, is_proroga, is_regolazione
    INTO v_row
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Già madre
  IF v_row.sostituisce_polizza IS NULL
     AND COALESCE(v_row.is_appendice_modifica, false) = false
     AND COALESCE(v_row.is_proroga, false) = false
     AND COALESCE(v_row.is_regolazione, false) = false THEN
    v_madre_id := v_row.id;
  ELSE
    -- Quietanza: madre = stesso numero_titolo, sostituisce_polizza NULL
    SELECT t.id INTO v_madre_id
    FROM public.titoli t
    WHERE t.numero_titolo = v_row.numero_titolo
      AND t.sostituisce_polizza IS NULL
      AND COALESCE(t.is_appendice_modifica, false) = false
      AND COALESCE(t.is_proroga, false) = false
      AND COALESCE(t.is_regolazione, false) = false
    ORDER BY t.riga NULLS LAST, t.created_at
    LIMIT 1;

    -- Fallback: sostituisce_polizza punta al numero madre
    IF v_madre_id IS NULL AND v_row.sostituisce_polizza IS NOT NULL THEN
      SELECT t.id INTO v_madre_id
      FROM public.titoli t
      WHERE t.numero_titolo = v_row.sostituisce_polizza
        AND t.sostituisce_polizza IS NULL
      ORDER BY t.riga NULLS LAST, t.created_at
      LIMIT 1;
    END IF;
  END IF;

  IF v_madre_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.titoli
  SET
    data_copertura = NULL,
    updated_at = now()
  WHERE id = v_madre_id
    AND data_copertura IS NOT NULL;
END;
$$;

-- 3) Trigger: impedisce di persistere data_copertura sulla madre
CREATE OR REPLACE FUNCTION public.enforce_no_copertura_polizza_madre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sostituisce_polizza IS NULL
     AND COALESCE(NEW.is_appendice_modifica, false) = false
     AND COALESCE(NEW.is_proroga, false) = false
     AND COALESCE(NEW.is_regolazione, false) = false
     AND NEW.data_copertura IS NOT NULL THEN
    NEW.data_copertura := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_no_copertura_madre ON public.titoli;
CREATE TRIGGER trg_titoli_no_copertura_madre
  BEFORE INSERT OR UPDATE OF data_copertura, sostituisce_polizza,
    is_appendice_modifica, is_proroga, is_regolazione
  ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_no_copertura_polizza_madre();

-- 4) Dopo elimina quietanza: pulisci eventuale copertura residua sulla madre
CREATE OR REPLACE FUNCTION public.elimina_quietanza_cascade(p_titolo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo RECORD;
  v_fin jsonb;
  v_ids uuid[];
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione riservata agli amministratori');
  END IF;

  SELECT id, numero_titolo, sostituisce_polizza, polizza_id
    INTO v_titolo
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Per eliminare l''intera polizza usare elimina_polizza_cascade'
    );
  END IF;

  -- Pulisci madre PRIMA del delete (il titolo quietanza esiste ancora)
  PERFORM public.clear_data_copertura_polizza_madre(p_titolo_id);

  v_ids := ARRAY[p_titolo_id];
  v_fin := public._elimina_titoli_finanziari(v_ids);

  UPDATE public.sinistri SET titolo_id = NULL WHERE titolo_id = p_titolo_id;

  PERFORM public._scollega_riferimenti_titoli(v_ids);

  DELETE FROM public.polizza_cga WHERE titolo_id = p_titolo_id;
  DELETE FROM public.quietanze WHERE titolo_id = p_titolo_id;

  DELETE FROM public.titoli WHERE id = p_titolo_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES (
    'elimina_quietanza_cascade',
    'titolo',
    p_titolo_id,
    'critical',
    v_fin || jsonb_build_object('numero_titolo', v_titolo.numero_titolo, 'titoli_eliminati', v_count),
    auth.uid()
  );

  RETURN v_fin || jsonb_build_object('ok', true, 'titoli_eliminati', v_count);
END;
$$;

-- 5) Se una quietanza perde la copertura (annullo), ripulisci residui sulla madre
CREATE OR REPLACE FUNCTION public.trg_clear_madre_copertura_after_quietanza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.data_copertura IS NOT NULL
     AND NEW.data_copertura IS NULL
     AND NEW.sostituisce_polizza IS NOT NULL THEN
    PERFORM public.clear_data_copertura_polizza_madre(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_madre_copertura_after_quietanza ON public.titoli;
CREATE TRIGGER trg_clear_madre_copertura_after_quietanza
  AFTER UPDATE OF data_copertura
  ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_clear_madre_copertura_after_quietanza();

GRANT EXECUTE ON FUNCTION public.clear_data_copertura_polizza_madre(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_data_copertura_polizza_madre(uuid) TO service_role;
