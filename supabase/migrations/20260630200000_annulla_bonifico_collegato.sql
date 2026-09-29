-- Annulla bonifico collegato/incassato: revoca incasso titoli + reset ricongiungimento → Da collegare

CREATE OR REPLACE FUNCTION public.annulla_bonifico_collegato(p_movimento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov record;
  v_titolo_id uuid;
  v_annulla jsonb;
  v_titoli_annullati int := 0;
  v_titoli_saltati int := 0;
  v_count_anticipi int := 0;
  v_count_mc int := 0;
  v_count_ammanco int := 0;
  v_result jsonb;
BEGIN
  SELECT id, stato, cliente_id, importo, ordinante
    INTO v_mov
  FROM public.movimenti_bancari
  WHERE id = p_movimento_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Movimento bancario non trovato');
  END IF;

  IF v_mov.stato NOT IN ('incassato', 'ricongiunti', 'assegnato') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Stato "%s" non annullabile. Solo bonifici incassati, ricongiunti o assegnati.', v_mov.stato)
    );
  END IF;

  IF v_mov.stato IN ('incassato', 'ricongiunti') THEN
    FOR v_titolo_id IN
      SELECT DISTINCT mp.titolo_id
      FROM public.movimenti_clienti mc
      JOIN public.movimenti_polizze mp ON mp.movimento_cliente_id = mc.id
      WHERE mc.movimento_id = p_movimento_id
        AND mp.tipo = 'polizza'
        AND mp.titolo_id IS NOT NULL
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = v_titolo_id) THEN
        v_titoli_saltati := v_titoli_saltati + 1;
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = v_titolo_id
          AND (
            t.stato = 'incassato'
            OR t.data_messa_cassa IS NOT NULL
            OR (COALESCE(t.conferimento_gestito, false) = true AND t.data_copertura IS NOT NULL)
          )
      ) THEN
        v_titoli_saltati := v_titoli_saltati + 1;
        CONTINUE;
      END IF;

      v_annulla := public.annulla_quietanza_incasso(v_titolo_id);
      IF COALESCE((v_annulla->>'ok')::boolean, false) = false THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', COALESCE(v_annulla->>'error', 'Errore annullamento incasso titolo'),
          'titolo_id', v_titolo_id
        );
      END IF;
      v_titoli_annullati := v_titoli_annullati + 1;
    END LOOP;
  END IF;

  WITH d AS (
    DELETE FROM public.cliente_anticipi_utilizzi u
    USING public.cliente_anticipi a
    WHERE u.anticipo_id = a.id
      AND a.movimento_bancario_id = p_movimento_id
    RETURNING 1
  ) SELECT count(*) INTO v_count_anticipi FROM d;

  DELETE FROM public.cliente_anticipi
  WHERE movimento_bancario_id = p_movimento_id;

  WITH d AS (
    DELETE FROM public.movimenti_contabili
    WHERE riferimento_tipo = 'movimento_bancario'
      AND riferimento_id = p_movimento_id
      AND categoria = 'ammanco_ricongiungimento'
    RETURNING 1
  ) SELECT count(*) INTO v_count_ammanco FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_clienti
    WHERE movimento_id = p_movimento_id
    RETURNING 1
  ) SELECT count(*) INTO v_count_mc FROM d;

  UPDATE public.movimenti_bancari
  SET stato = 'importato'::public.movimento_bancario_stato,
      cliente_id = NULL,
      updated_at = now()
  WHERE id = p_movimento_id;

  v_result := jsonb_build_object(
    'ok', true,
    'stato_nuovo', 'importato',
    'cliente_rimosso', v_mov.cliente_id IS NOT NULL,
    'titoli_annullati', v_titoli_annullati,
    'titoli_saltati', v_titoli_saltati,
    'movimenti_clienti_eliminati', v_count_mc,
    'anticipi_utilizzi_eliminati', v_count_anticipi,
    'ammanco_eliminati', v_count_ammanco
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_bonifico_collegato', 'movimento_bancario', p_movimento_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.annulla_bonifico_collegato(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_bonifico_collegato(uuid) TO service_role;
