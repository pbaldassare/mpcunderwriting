CREATE OR REPLACE FUNCTION public.annulla_quietanza_incasso(p_titolo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_titolo RECORD;
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_next_rata_id uuid;
  v_next_has_deps boolean := false;
  v_count_pag_righe int := 0;
  v_count_prov int := 0;
  v_count_rim_dett int := 0;
  v_count_rim_eliminate int := 0;
  v_count_mov_cont int := 0;
  v_count_anticipi int := 0;
  v_count_comp int := 0;
  v_count_modalita int := 0;
  v_count_next_rata int := 0;
  v_quietanze_agg int := 0;
  v_rimessa_bloccata text;
  v_result jsonb;
  v_ha_trattenuta boolean;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza, stato, data_messa_cassa
    INTO v_titolo
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL AND v_titolo.data_messa_cassa IS NULL AND v_titolo.stato <> 'incassato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione valida solo su quietanze incassate o messe a cassa');
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

  SELECT id INTO v_next_rata_id
  FROM public.titoli
  WHERE sostituisce_polizza = v_titolo.numero_titolo
    AND ((v_titolo.riga IS NULL AND sostituisce_riga IS NULL) OR sostituisce_riga = v_titolo.riga)
    AND stato = 'attivo'
    AND data_messa_cassa IS NULL
    AND COALESCE(is_regolazione, false) = false
  LIMIT 1;

  IF v_next_rata_id IS NOT NULL THEN
    -- Elimina la rata successiva SOLO se è uno "scheletro" senza dati collegati
    -- (auto-generata dal trigger di messa a cassa). Se ha già movimenti bancari,
    -- provvigioni, rimesse o altri dati la preserviamo per evitare FK violation
    -- e perdita di dati.
    SELECT
      EXISTS (SELECT 1 FROM public.movimenti_polizze WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.provvigioni_generate WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.rimessa_dettaglio WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.titoli_compensazioni WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.cliente_anticipi_utilizzi WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.titoli_modalita_incasso WHERE titolo_id = v_next_rata_id)
      OR EXISTS (SELECT 1 FROM public.movimenti_contabili WHERE riferimento_tipo = 'titolo' AND riferimento_id = v_next_rata_id)
    INTO v_next_has_deps;

    IF NOT v_next_has_deps THEN
      DELETE FROM public.quietanze WHERE titolo_id = v_next_rata_id;
      DELETE FROM public.titoli WHERE id = v_next_rata_id;
      v_count_next_rata := 1;
    END IF;
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
    'rata_successiva_eliminata', v_count_next_rata > 0,
    'rata_successiva_preservata', v_next_rata_id IS NOT NULL AND v_next_has_deps,
    'quietanze_aggiornate', v_quietanze_agg
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_quietanza_incasso', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$function$;