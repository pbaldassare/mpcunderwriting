-- RPC transazionale per annullamento polizza con cascade
CREATE OR REPLACE FUNCTION public.annulla_polizza_cascade(p_titolo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo RECORD;
  v_ids uuid[];
  v_quietanze_ids uuid[];
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_count_pag_righe int := 0;
  v_count_prov int := 0;
  v_count_prov_pagate int := 0;
  v_count_rim_dett int := 0;
  v_count_rim_eliminate int := 0;
  v_count_mov_cont int := 0;
  v_count_mov_pol int := 0;
  v_count_splits int := 0;
  v_count_quietanze int := 0;
  v_result jsonb;
BEGIN
  -- Carica titolo target
  SELECT id, numero_titolo, riga INTO v_titolo
  FROM public.titoli WHERE id = p_titolo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  -- Lookup ricorsivo quietanze discendenti via sostituisce_polizza/sostituisce_riga
  WITH RECURSIVE chain AS (
    SELECT id, numero_titolo, riga FROM public.titoli WHERE id = p_titolo_id
    UNION
    SELECT f.id, f.numero_titolo, f.riga
    FROM public.titoli f
    JOIN chain c ON f.sostituisce_polizza = c.numero_titolo AND f.sostituisce_riga = c.riga
  )
  SELECT array_agg(id) INTO v_ids FROM chain;

  v_quietanze_ids := (SELECT array_agg(id) FROM unnest(v_ids) id WHERE id <> p_titolo_id);
  IF v_quietanze_ids IS NULL THEN v_quietanze_ids := ARRAY[]::uuid[]; END IF;

  -- Bypass eventuali lock messa a cassa
  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);

  -- Provvigioni: raccolgo id prima del delete
  SELECT array_agg(id), count(*) FILTER (WHERE pagata = true)
    INTO v_prov_ids, v_count_prov_pagate
  FROM public.provvigioni_generate WHERE titolo_id = ANY(v_ids);
  IF v_prov_ids IS NULL THEN v_prov_ids := ARRAY[]::uuid[]; END IF;

  -- Rimesse coinvolte (per pulizia testate vuote dopo)
  SELECT array_agg(DISTINCT rimessa_id) INTO v_rimesse_ids
  FROM public.rimessa_dettaglio WHERE titolo_id = ANY(v_ids);
  IF v_rimesse_ids IS NULL THEN v_rimesse_ids := ARRAY[]::uuid[]; END IF;

  -- 1. pagamenti_provvigioni_righe
  IF array_length(v_prov_ids, 1) > 0 THEN
    WITH d AS (DELETE FROM public.pagamenti_provvigioni_righe
               WHERE provvigione_id = ANY(v_prov_ids) RETURNING 1)
    SELECT count(*) INTO v_count_pag_righe FROM d;
  END IF;

  -- 2. provvigioni_generate
  WITH d AS (DELETE FROM public.provvigioni_generate
             WHERE titolo_id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_prov FROM d;

  -- 3. rimessa_dettaglio
  WITH d AS (DELETE FROM public.rimessa_dettaglio
             WHERE titolo_id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_rim_dett FROM d;

  -- 4. movimenti_contabili
  WITH d AS (DELETE FROM public.movimenti_contabili
             WHERE riferimento_tipo = 'titolo' AND riferimento_id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_mov_cont FROM d;

  -- 5. movimenti_polizza
  WITH d AS (DELETE FROM public.movimenti_polizza
             WHERE titolo_id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_mov_pol FROM d;

  -- 6. titoli_split_commerciali
  WITH d AS (DELETE FROM public.titoli_split_commerciali
             WHERE titolo_id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_splits FROM d;

  -- 7. quietanze discendenti (delete fisica)
  IF array_length(v_quietanze_ids, 1) > 0 THEN
    WITH d AS (DELETE FROM public.titoli WHERE id = ANY(v_quietanze_ids) RETURNING 1)
    SELECT count(*) INTO v_count_quietanze FROM d;
  END IF;

  -- 8. Cleanup testate rimessa rimaste senza righe → elimina
  IF array_length(v_rimesse_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.rimessa_premi rp
      WHERE rp.id = ANY(v_rimesse_ids)
        AND NOT EXISTS (SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.rimessa_id = rp.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_rim_eliminate FROM d;
  END IF;

  -- 9. Reset titolo target
  UPDATE public.titoli SET
    stato = 'annullato',
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    data_conferimento_gestito = NULL,
    updated_at = now()
  WHERE id = p_titolo_id;

  v_result := jsonb_build_object(
    'ok', true,
    'quietanze_eliminate', v_count_quietanze,
    'provvigioni_eliminate', v_count_prov,
    'pagamenti_righe_eliminate', v_count_pag_righe,
    'rimessa_dettagli_eliminati', v_count_rim_dett,
    'rimesse_testate_eliminate', v_count_rim_eliminate,
    'movimenti_eliminati', v_count_mov_cont,
    'movimenti_polizza_eliminati', v_count_mov_pol,
    'splits_eliminati', v_count_splits,
    'includeva_provvigioni_pagate', v_count_prov_pagate > 0
  );

  -- Log
  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annullamento_polizza_cascade', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.annulla_polizza_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_polizza_cascade(uuid) TO service_role;