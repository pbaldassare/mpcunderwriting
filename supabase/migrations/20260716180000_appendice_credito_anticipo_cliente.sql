-- Appendice/titolo a credito (premio_lordo < 0): alla messa a cassa crea acconto cliente.
-- Annulla messa a cassa: rimuove l'acconto se non usato/rimborsato.
-- Supporto "segna rimborsato" su cliente_anticipi.

ALTER TABLE public.cliente_anticipi
  ADD COLUMN IF NOT EXISTS titolo_origine_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rimborsato_il date,
  ADD COLUMN IF NOT EXISTS rimborsato_note text,
  ADD COLUMN IF NOT EXISTS rimborsato_da uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_anticipi_titolo_origine
  ON public.cliente_anticipi(titolo_origine_id)
  WHERE titolo_origine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_anticipi_titolo_origine
  ON public.cliente_anticipi(titolo_origine_id)
  WHERE titolo_origine_id IS NOT NULL;

COMMENT ON COLUMN public.cliente_anticipi.titolo_origine_id IS
  'Titolo (appendice/quietanza a credito) che ha generato questo acconto alla messa a cassa.';
COMMENT ON COLUMN public.cliente_anticipi.rimborsato_il IS
  'Se valorizzata, acconto chiuso per rimborso/bonifico al cliente (non più utilizzabile).';

-- Acconti rimborsati: il ricalcolo residuo non riapre il credito
CREATE OR REPLACE FUNCTION public.anticipi_ricalcola_residuo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aid UUID; v_imp NUMERIC(12,2); v_us NUMERIC(12,2); v_rimb date;
BEGIN
  v_aid := COALESCE(NEW.anticipo_id, OLD.anticipo_id);
  SELECT importo, rimborsato_il INTO v_imp, v_rimb FROM public.cliente_anticipi WHERE id = v_aid;
  IF v_imp IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_rimb IS NOT NULL THEN
    UPDATE public.cliente_anticipi SET importo_residuo = 0, updated_at = now() WHERE id = v_aid;
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COALESCE(SUM(importo_utilizzato),0) INTO v_us FROM public.cliente_anticipi_utilizzi WHERE anticipo_id = v_aid;
  IF v_us > v_imp THEN RAISE EXCEPTION 'Utilizzo (%) eccede importo anticipo (%)', v_us, v_imp; END IF;
  UPDATE public.cliente_anticipi SET importo_residuo = v_imp - v_us, updated_at = now() WHERE id = v_aid;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- Acconti disponibili: residuo > 0 e non rimborsati
CREATE OR REPLACE FUNCTION public.anticipi_disponibile(a public.cliente_anticipi)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT a.importo_residuo > 0 AND a.rimborsato_il IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- Patch annulla_quietanza_incasso: gestisce acconto generato da titolo a credito
-- ---------------------------------------------------------------------------
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
  v_count_anticipo_origine int := 0;
  v_quietanze_agg int := 0;
  v_rimessa_bloccata text;
  v_result jsonb;
  v_ha_trattenuta boolean;
  v_ref_ts timestamptz;
  v_anticipo_origine RECORD;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza, stato, data_messa_cassa,
         data_incasso, conferimento_gestito, data_copertura, created_at,
         is_appendice_modifica, is_proroga, is_regolazione
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

  -- Quietanze (sostituisce_polizza valorizzato) oppure appendici AM/PR/RG one-shot, oppure madre già incassata
  IF v_titolo.sostituisce_polizza IS NULL
     AND COALESCE(v_titolo.is_appendice_modifica, false) = false
     AND COALESCE(v_titolo.is_proroga, false) = false
     AND COALESCE(v_titolo.is_regolazione, false) = false
     AND v_titolo.data_messa_cassa IS NULL
     AND v_titolo.stato <> 'incassato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione valida solo su quietanze/appendici incassate, messe a cassa o in copertura garantita');
  END IF;

  -- Acconto generato da questo titolo a credito: blocco se già usato o rimborsato
  SELECT * INTO v_anticipo_origine
  FROM public.cliente_anticipi
  WHERE titolo_origine_id = p_titolo_id
  LIMIT 1;

  IF FOUND THEN
    IF v_anticipo_origine.rimborsato_il IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Impossibile annullare: l''acconto generato da questo titolo è già stato rimborsato/bonificato.'
      );
    END IF;
    IF round(v_anticipo_origine.importo_residuo::numeric, 2) < round(v_anticipo_origine.importo::numeric, 2) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Impossibile annullare: l''acconto generato da questo titolo è già stato utilizzato su altre quietanze. Stornare prima gli utilizzi.'
      );
    END IF;
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

  -- Rimuove acconto generato da questo titolo (solo se ancora integro — già verificato sopra)
  WITH d AS (
    DELETE FROM public.cliente_anticipi
    WHERE titolo_origine_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_anticipo_origine FROM d;

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
    'anticipo_origine_eliminato', v_count_anticipo_origine,
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
