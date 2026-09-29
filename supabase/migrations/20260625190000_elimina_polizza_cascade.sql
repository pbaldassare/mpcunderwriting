-- Eliminazione fisica polizza/quietanza con cascade completo (incassi, provvigioni, rimesse, ecc.)
-- Opzione B: il titolo madre viene cancellato, non solo marcato annullato.
-- Solo admin (has_role su user_roles).

CREATE OR REPLACE FUNCTION public._titoli_chain_ids(p_titolo_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_madre_id uuid;
  v_numero text;
  v_riga int;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza
    INTO v_madre_id, v_numero, v_riga, v_numero
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- Risali alla madre se chiamato su una rata
  IF (SELECT sostituisce_polizza FROM public.titoli WHERE id = p_titolo_id) IS NOT NULL THEN
    SELECT id INTO v_madre_id
    FROM public.titoli
    WHERE numero_titolo = (SELECT numero_titolo FROM public.titoli WHERE id = p_titolo_id)
      AND sostituisce_polizza IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_madre_id IS NULL THEN
      v_madre_id := p_titolo_id;
    END IF;
  END IF;

  RETURN (
    WITH RECURSIVE chain AS (
      SELECT id FROM public.titoli WHERE id = v_madre_id
      UNION
      SELECT f.id
      FROM public.titoli f
      JOIN chain c ON f.sostituisce_polizza = (SELECT numero_titolo FROM public.titoli WHERE id = c.id)
                 AND (
                   (SELECT riga FROM public.titoli WHERE id = c.id) IS NULL AND f.sostituisce_riga IS NULL
                   OR f.sostituisce_riga = (SELECT riga FROM public.titoli WHERE id = c.id)
                 )
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) FROM chain
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._elimina_titoli_finanziari(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_count_pag_righe int := 0;
  v_count_prov int := 0;
  v_count_prov_pagate int := 0;
  v_count_rim_dett int := 0;
  v_count_rim_eliminate int := 0;
  v_count_mov_cont int := 0;
  v_count_mov_pol int := 0;
  v_count_mov_polizze int := 0;
  v_count_splits int := 0;
  v_count_comp int := 0;
  v_count_anticipi int := 0;
  v_count_note_rest int := 0;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);
  PERFORM set_config('app.bypass_premi_lock', 'on', true);

  SELECT array_agg(id), count(*) FILTER (WHERE pagata = true)
    INTO v_prov_ids, v_count_prov_pagate
  FROM public.provvigioni_generate
  WHERE titolo_id = ANY(p_ids);
  IF v_prov_ids IS NULL THEN v_prov_ids := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(DISTINCT rimessa_id) INTO v_rimesse_ids
  FROM public.rimessa_dettaglio
  WHERE titolo_id = ANY(p_ids);
  IF v_rimesse_ids IS NULL THEN v_rimesse_ids := ARRAY[]::uuid[]; END IF;

  IF array_length(v_prov_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.pagamenti_provvigioni_righe
      WHERE provvigione_id = ANY(v_prov_ids)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_pag_righe FROM d;
  END IF;

  WITH d AS (DELETE FROM public.provvigioni_generate WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_prov FROM d;

  WITH d AS (DELETE FROM public.rimessa_dettaglio WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_rim_dett FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_contabili
    WHERE riferimento_tipo = 'titolo' AND riferimento_id = ANY(p_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_count_mov_cont FROM d;

  WITH d AS (DELETE FROM public.movimenti_polizza WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_mov_pol FROM d;

  WITH d AS (DELETE FROM public.movimenti_polizze WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_mov_polizze FROM d;

  WITH d AS (DELETE FROM public.titoli_split_commerciali WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_splits FROM d;

  WITH d AS (DELETE FROM public.titoli_compensazioni WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_comp FROM d;

  WITH d AS (DELETE FROM public.cliente_anticipi_utilizzi WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_anticipi FROM d;

  WITH d AS (DELETE FROM public.note_restituzione_dettaglio WHERE titolo_id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count_note_rest FROM d;

  IF array_length(v_rimesse_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.rimessa_premi rp
      WHERE rp.id = ANY(v_rimesse_ids)
        AND NOT EXISTS (SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.rimessa_id = rp.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_rim_eliminate FROM d;
  END IF;

  RETURN jsonb_build_object(
    'provvigioni_eliminate', v_count_prov,
    'pagamenti_righe_eliminate', v_count_pag_righe,
    'rimessa_dettagli_eliminati', v_count_rim_dett,
    'rimesse_testate_eliminate', v_count_rim_eliminate,
    'movimenti_eliminati', v_count_mov_cont,
    'movimenti_polizza_eliminati', v_count_mov_pol,
    'movimenti_polizze_eliminati', v_count_mov_polizze,
    'splits_eliminati', v_count_splits,
    'compensazioni_eliminate', v_count_comp,
    'anticipi_eliminati', v_count_anticipi,
    'note_restituzione_eliminate', v_count_note_rest,
    'includeva_provvigioni_pagate', v_count_prov_pagate > 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._scollega_riferimenti_titoli(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.titoli SET regolazione_quietanza_id = NULL
  WHERE regolazione_quietanza_id = ANY(p_ids);

  UPDATE public.titoli SET titolo_storno_id = NULL
  WHERE titolo_storno_id = ANY(p_ids);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'titoli' AND column_name = 'proroga_polizza_madre_id'
  ) THEN
    EXECUTE 'UPDATE public.titoli SET proroga_polizza_madre_id = NULL WHERE proroga_polizza_madre_id = ANY($1)'
    USING p_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'titoli' AND column_name = 'appendice_modifica_polizza_madre_id'
  ) THEN
    EXECUTE 'UPDATE public.titoli SET appendice_modifica_polizza_madre_id = NULL WHERE appendice_modifica_polizza_madre_id = ANY($1)'
    USING p_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'titoli' AND column_name = 'titolo_modifica_id'
  ) THEN
    EXECUTE 'UPDATE public.titoli SET titolo_modifica_id = NULL WHERE titolo_modifica_id = ANY($1)'
    USING p_ids;
  END IF;

  UPDATE public.titoli_regolazioni SET titolo_regolazione_id = NULL
  WHERE titolo_regolazione_id = ANY(p_ids);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'titoli_regolazioni' AND column_name = 'quietanza_riferimento_id'
  ) THEN
    EXECUTE 'UPDATE public.titoli_regolazioni SET quietanza_riferimento_id = NULL WHERE quietanza_riferimento_id = ANY($1)'
    USING p_ids;
  END IF;

  UPDATE public.titoli_storni SET titolo_storno_id = NULL
  WHERE titolo_storno_id = ANY(p_ids);

  UPDATE public.titoli_sostituzioni SET titolo_conguaglio_id = NULL
  WHERE titolo_conguaglio_id = ANY(p_ids);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appendici_polizza' AND column_name = 'titolo_proroga_id'
  ) THEN
    EXECUTE 'UPDATE public.appendici_polizza SET titolo_proroga_id = NULL WHERE titolo_proroga_id = ANY($1)'
    USING p_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appendici_polizza' AND column_name = 'titolo_modifica_id'
  ) THEN
    EXECUTE 'UPDATE public.appendici_polizza SET titolo_modifica_id = NULL WHERE titolo_modifica_id = ANY($1)'
    USING p_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'titoli_proroghe'
  ) THEN
    EXECUTE 'UPDATE public.titoli_proroghe SET titolo_proroga_id = NULL WHERE titolo_proroga_id = ANY($1)'
    USING p_ids;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.elimina_polizza_cascade(p_titolo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_polizza_ids uuid[];
  v_fin jsonb;
  v_count_titoli int := 0;
  v_count_quietanze int := 0;
  v_count_polizze int := 0;
  v_numero text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione riservata agli amministratori');
  END IF;

  v_ids := public._titoli_chain_ids(p_titolo_id);
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  SELECT numero_titolo INTO v_numero
  FROM public.titoli
  WHERE id = v_ids[1];

  SELECT COALESCE(array_agg(DISTINCT polizza_id), ARRAY[]::uuid[])
    INTO v_polizza_ids
  FROM public.titoli
  WHERE id = ANY(v_ids) AND polizza_id IS NOT NULL;

  v_fin := public._elimina_titoli_finanziari(v_ids);

  UPDATE public.sinistri SET titolo_id = NULL WHERE titolo_id = ANY(v_ids);

  PERFORM public._scollega_riferimenti_titoli(v_ids);

  DELETE FROM public.polizza_cga WHERE titolo_id = ANY(v_ids);

  WITH d AS (
    DELETE FROM public.quietanze
    WHERE titolo_id = ANY(v_ids)
       OR (array_length(v_polizza_ids, 1) > 0 AND polizza_id = ANY(v_polizza_ids))
    RETURNING 1
  )
  SELECT count(*) INTO v_count_quietanze FROM d;

  WITH d AS (DELETE FROM public.titoli WHERE id = ANY(v_ids) RETURNING 1)
  SELECT count(*) INTO v_count_titoli FROM d;

  IF v_polizza_ids IS NOT NULL AND array_length(v_polizza_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.polizze p
      WHERE p.id = ANY(v_polizza_ids)
        AND NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.polizza_id = p.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_polizze FROM d;
  END IF;

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES (
    'elimina_polizza_cascade',
    'titolo',
    p_titolo_id,
    'critical',
    v_fin || jsonb_build_object(
      'numero_titolo', v_numero,
      'titoli_eliminati', v_count_titoli,
      'quietanze_eliminate', v_count_quietanze,
      'polizze_eliminate', v_count_polizze
    ),
    auth.uid()
  );

  RETURN v_fin || jsonb_build_object(
    'ok', true,
    'titoli_eliminati', v_count_titoli,
    'quietanze_eliminate', v_count_quietanze,
    'polizze_eliminate', v_count_polizze
  );
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.elimina_polizza_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elimina_polizza_cascade(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.elimina_quietanza_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elimina_quietanza_cascade(uuid) TO service_role;
