-- Fix elimina_polizza_cascade: quietanza_riferimento_id è su titoli_regolazioni, non titoli.
-- Helper centralizzato per scollegare FK verso titoli in eliminazione.

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
