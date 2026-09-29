-- Annulla incasso: rimuove collegamenti ricongiungimento bancario (movimenti_polizze)
-- prima di eventuale delete titoli, e non cancella rate pre-generate (es. 2/2 semestrale).
-- Fix FK: movimenti_polizze_titolo_id_fkey

CREATE OR REPLACE FUNCTION public.annulla_quietanza_incasso(p_titolo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo RECORD;
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_next_rata_id uuid;
  v_count_pag_righe int := 0;
  v_count_prov int := 0;
  v_count_rim_dett int := 0;
  v_count_rim_eliminate int := 0;
  v_count_mov_cont int := 0;
  v_count_anticipi int := 0;
  v_count_comp int := 0;
  v_count_modalita int := 0;
  v_count_next_rata int := 0;
  v_count_giroconti int := 0;
  v_count_mov_pol int := 0;
  v_count_mov_polizze_reset int := 0;
  v_quietanze_agg int := 0;
  v_rimessa_bloccata text;
  v_result jsonb;
  v_ha_trattenuta boolean;
  v_ref_ts timestamptz;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza, stato, data_messa_cassa,
         data_incasso, conferimento_gestito, data_copertura, created_at
    INTO v_titolo
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  -- Solo copertura garantita (nessun incasso): reset leggero.
  IF v_titolo.data_messa_cassa IS NULL
     AND COALESCE(v_titolo.conferimento_gestito, false) = true
     AND v_titolo.data_copertura IS NOT NULL THEN
    UPDATE public.titoli SET
      stato = 'attivo',
      data_copertura = NULL,
      data_decorrenza_rinnovo = NULL,
      tipo_pagamento = NULL,
      conferimento_gestito = false,
      fondi_ricevuti = true,
      data_conferimento_gestito = NULL,
      updated_at = now()
    WHERE id = p_titolo_id;

    UPDATE public.quietanze SET data_copertura = NULL, updated_at = now()
    WHERE titolo_id = p_titolo_id;
    GET DIAGNOSTICS v_quietanze_agg = ROW_COUNT;

    INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
    VALUES ('annulla_copertura_garantita', 'titolo', p_titolo_id, 'warning',
      jsonb_build_object('ok', true, 'quietanze_aggiornate', v_quietanze_agg), auth.uid());

    RETURN jsonb_build_object('ok', true, 'solo_copertura', true, 'quietanze_aggiornate', v_quietanze_agg);
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL AND v_titolo.data_messa_cassa IS NULL AND v_titolo.stato <> 'incassato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione valida solo su quietanze incassate, messe a cassa o in copertura garantita');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.titoli_modalita_incasso
    WHERE titolo_id = p_titolo_id AND stato = 'attiva' AND modalita = 'produttore_trattiene_provv'
  ) INTO v_ha_trattenuta;

  IF v_ha_trattenuta THEN
    UPDATE public.provvigioni_generate SET pagata = false
    WHERE titolo_id = p_titolo_id AND pagata = true AND tipo_destinatario = 'commerciale';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id AND pagata = true
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Impossibile annullare: esistono provvigioni già pagate per questo titolo.'
    );
  END IF;

  SELECT rp.stato INTO v_rimessa_bloccata
  FROM public.rimessa_dettaglio rd
  JOIN public.rimessa_premi rp ON rp.id = rd.rimessa_id
  WHERE rd.titolo_id = p_titolo_id
    AND rp.stato NOT IN ('bozza', 'annullata')
  LIMIT 1;

  IF v_rimessa_bloccata IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Impossibile annullare: titolo incluso in rimessa con stato "%s".', v_rimessa_bloccata)
    );
  END IF;

  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);

  WITH d AS (
    DELETE FROM public.titoli_modalita_incasso WHERE titolo_id = p_titolo_id RETURNING 1
  )
  SELECT count(*) INTO v_count_modalita FROM d;

  SELECT array_agg(id) INTO v_prov_ids
  FROM public.provvigioni_generate
  WHERE titolo_id = p_titolo_id;
  IF v_prov_ids IS NULL THEN v_prov_ids := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(DISTINCT rimessa_id) INTO v_rimesse_ids
  FROM public.rimessa_dettaglio
  WHERE titolo_id = p_titolo_id;
  IF v_rimesse_ids IS NULL THEN v_rimesse_ids := ARRAY[]::uuid[]; END IF;

  IF array_length(v_prov_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.pagamenti_provvigioni_righe
      WHERE provvigione_id = ANY(v_prov_ids)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_pag_righe FROM d;
  END IF;

  WITH d AS (
    DELETE FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_prov FROM d;

  WITH d AS (
    DELETE FROM public.rimessa_dettaglio
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_rim_dett FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_contabili
    WHERE riferimento_tipo = 'titolo' AND riferimento_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_mov_cont FROM d;

  WITH d AS (
    DELETE FROM public.cliente_anticipi_utilizzi
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_anticipi FROM d;

  WITH d AS (
    DELETE FROM public.titoli_compensazioni
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_comp FROM d;

  WITH d AS (
    DELETE FROM public.giroconti_cliente WHERE titolo_id = p_titolo_id RETURNING 1
  )
  SELECT count(*) INTO v_count_giroconti FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_polizza WHERE titolo_id = p_titolo_id RETURNING 1
  )
  SELECT count(*) INTO v_count_mov_pol FROM d;

  -- Bonifico/ricongiungimento: ripristina righe collegate (non elimina il ricongiungimento).
  WITH u AS (
    UPDATE public.movimenti_polizze
    SET messo_a_cassa = false,
        data_messa_cassa = NULL
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_mov_polizze_reset FROM u;

  v_ref_ts := COALESCE(
    v_titolo.data_incasso::timestamptz,
    v_titolo.data_messa_cassa::timestamptz,
    v_titolo.created_at
  );

  -- Elimina solo rate generate DOPO l'incasso/messa a cassa (non le rate pre-generate 2/N).
  SELECT t_next.id INTO v_next_rata_id
  FROM public.titoli t_next
  WHERE t_next.sostituisce_polizza = v_titolo.numero_titolo
    AND ((v_titolo.riga IS NULL AND t_next.sostituisce_riga IS NULL) OR t_next.sostituisce_riga = v_titolo.riga)
    AND t_next.stato = 'attivo'
    AND t_next.data_messa_cassa IS NULL
    AND COALESCE(t_next.is_regolazione, false) = false
    AND t_next.created_at > v_ref_ts
  LIMIT 1;

  IF v_next_rata_id IS NOT NULL THEN
    DELETE FROM public.movimenti_polizze WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.movimenti_polizza WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.provvigioni_generate WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.premi_garanzia_polizza WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.quietanze WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.titoli WHERE id = v_next_rata_id;
    v_count_next_rata := 1;
  END IF;

  IF array_length(v_rimesse_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.rimessa_premi rp
      WHERE rp.id = ANY(v_rimesse_ids)
        AND NOT EXISTS (SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.rimessa_id = rp.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_rim_eliminate FROM d;
  END IF;

  UPDATE public.titoli SET
    stato = 'attivo',
    data_messa_cassa = NULL,
    data_copertura = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    data_decorrenza_rinnovo = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    fondi_ricevuti = true,
    data_conferimento_gestito = NULL,
    updated_at = now()
  WHERE id = p_titolo_id;

  UPDATE public.quietanze SET
    stato = 'da_incassare',
    data_messa_cassa = NULL,
    data_copertura = NULL,
    data_pagamento = NULL,
    data_incasso = NULL,
    importo_incassato = NULL,
    tipo_incasso = NULL,
    conto_incasso = NULL,
    updated_at = now()
  WHERE titolo_id = p_titolo_id;
  GET DIAGNOSTICS v_quietanze_agg = ROW_COUNT;

  v_result := jsonb_build_object(
    'ok', true,
    'provvigioni_eliminate', v_count_prov,
    'pagamenti_righe_eliminate', v_count_pag_righe,
    'rimessa_dettagli_eliminati', v_count_rim_dett,
    'rimesse_testate_eliminate', v_count_rim_eliminate,
    'movimenti_eliminati', v_count_mov_cont,
    'anticipi_eliminati', v_count_anticipi,
    'compensazioni_eliminate', v_count_comp,
    'modalita_incasso_eliminate', v_count_modalita,
    'giroconti_eliminati', v_count_giroconti,
    'movimenti_polizza_eliminati', v_count_mov_pol,
    'movimenti_polizze_reset', v_count_mov_polizze_reset,
    'rata_successiva_eliminata', v_count_next_rata > 0,
    'quietanze_aggiornate', v_quietanze_agg
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_quietanza_incasso', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.annulla_quietanza_incasso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_quietanza_incasso(uuid) TO service_role;
