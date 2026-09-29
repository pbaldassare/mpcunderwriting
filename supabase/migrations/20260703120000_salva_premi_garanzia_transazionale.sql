-- Salvataggio transazionale premi per garanzia + fix provvigioni appendici
--
-- 1) RPC salva_premi_garanzia_titolo: sostituisce il ciclo delete/insert/update
--    lato client con una singola transazione atomica (evita stati parziali su
--    premi_garanzia_polizza e titoli in caso di errore intermedio).
-- 2) Fix crea_titolo_da_modifica / _da_proroga / _da_regolazione: la colonna
--    percentuale_provvigione non esiste piu su titoli; le provvigioni vanno
--    scritte sia su provvigioni_firma sia su provvigioni_quietanza.

-- ---------------------------------------------------------------------------
-- 1) RPC salva_premi_garanzia_titolo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salva_premi_garanzia_titolo(
  p_titolo_id uuid,
  p_tipo_premio text,
  p_rows jsonb,
  p_titolo_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticazione richiesta';
  END IF;

  IF p_tipo_premio NOT IN ('firma', 'quietanza') THEN
    RAISE EXCEPTION 'tipo_premio non valido: %', p_tipo_premio;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.titoli WHERE id = p_titolo_id) THEN
    RAISE EXCEPTION 'Titolo % non trovato', p_titolo_id;
  END IF;

  PERFORM id FROM public.titoli WHERE id = p_titolo_id FOR UPDATE;

  DELETE FROM public.premi_garanzia_polizza
  WHERE titolo_id = p_titolo_id
    AND tipo_premio = p_tipo_premio;

  IF p_rows IS NOT NULL AND jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO public.premi_garanzia_polizza (
      titolo_id, tipo_premio, garanzia, codice_garanzia,
      capitale, tasso, firma, rata, accessori, annuo, ordine,
      aliquota_tasse_pct, ssn, tasse_rettifica,
      provvigione_netto_pct, provvigione_accessori_pct, quietanza_personalizzata
    )
    SELECT
      p_titolo_id,
      p_tipo_premio,
      COALESCE(r.garanzia, 'Premio'),
      NULLIF(r.codice_garanzia, ''),
      COALESCE(r.capitale, 0),
      COALESCE(r.tasso, 0),
      COALESCE(r.firma, 0),
      COALESCE(r.rata, 0),
      COALESCE(r.accessori, 0),
      COALESCE(r.annuo, 0),
      COALESCE(r.ordine, 0),
      r.aliquota_tasse_pct,
      COALESCE(r.ssn, 0),
      COALESCE(r.tasse_rettifica, 0),
      r.provvigione_netto_pct,
      r.provvigione_accessori_pct,
      COALESCE(r.quietanza_personalizzata, false)
    FROM jsonb_to_recordset(p_rows) AS r(
      garanzia text,
      codice_garanzia text,
      capitale numeric,
      tasso numeric,
      firma numeric,
      rata numeric,
      accessori numeric,
      annuo numeric,
      ordine int,
      aliquota_tasse_pct numeric,
      ssn numeric,
      tasse_rettifica numeric,
      provvigione_netto_pct numeric,
      provvigione_accessori_pct numeric,
      quietanza_personalizzata boolean
    );
  END IF;

  UPDATE public.titoli SET
    premio_netto = CASE WHEN p_titolo_updates ? 'premio_netto' THEN (p_titolo_updates->>'premio_netto')::numeric ELSE premio_netto END,
    addizionali = CASE WHEN p_titolo_updates ? 'addizionali' THEN (p_titolo_updates->>'addizionali')::numeric ELSE addizionali END,
    tasse = CASE WHEN p_titolo_updates ? 'tasse' THEN (p_titolo_updates->>'tasse')::numeric ELSE tasse END,
    ssn_firma = CASE WHEN p_titolo_updates ? 'ssn_firma' THEN (p_titolo_updates->>'ssn_firma')::numeric ELSE ssn_firma END,
    premio_lordo = CASE WHEN p_titolo_updates ? 'premio_lordo' THEN (p_titolo_updates->>'premio_lordo')::numeric ELSE premio_lordo END,
    provvigioni_firma = CASE WHEN p_titolo_updates ? 'provvigioni_firma' THEN (p_titolo_updates->>'provvigioni_firma')::numeric ELSE provvigioni_firma END,
    premio_netto_quietanza = CASE WHEN p_titolo_updates ? 'premio_netto_quietanza' THEN (p_titolo_updates->>'premio_netto_quietanza')::numeric ELSE premio_netto_quietanza END,
    addizionali_quietanza = CASE WHEN p_titolo_updates ? 'addizionali_quietanza' THEN (p_titolo_updates->>'addizionali_quietanza')::numeric ELSE addizionali_quietanza END,
    tasse_quietanza = CASE WHEN p_titolo_updates ? 'tasse_quietanza' THEN (p_titolo_updates->>'tasse_quietanza')::numeric ELSE tasse_quietanza END,
    ssn_quietanza = CASE WHEN p_titolo_updates ? 'ssn_quietanza' THEN (p_titolo_updates->>'ssn_quietanza')::numeric ELSE ssn_quietanza END,
    provvigioni_quietanza = CASE WHEN p_titolo_updates ? 'provvigioni_quietanza' THEN (p_titolo_updates->>'provvigioni_quietanza')::numeric ELSE provvigioni_quietanza END,
    updated_at = now()
  WHERE id = p_titolo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) crea_titolo_da_modifica: no percentuale_provvigione, usa provvigioni_quietanza
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crea_titolo_da_modifica(p_appendice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_madre record;
  v_new_id uuid;
  v_numero_am text;
  v_seq int;
  v_perc numeric;
  v_prov numeric;
  v_base_numero text;
BEGIN
  SELECT * INTO v_app FROM public.appendici_polizza WHERE id = p_appendice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appendice % non trovata', p_appendice_id; END IF;
  IF v_app.tipo <> 'modifica' THEN RAISE EXCEPTION 'Appendice non è di tipo modifica'; END IF;
  IF v_app.titolo_modifica_id IS NOT NULL THEN
    PERFORM public.fn_collega_quietanza_appendice(v_app.titolo_modifica_id);
    RETURN v_app.titolo_modifica_id;
  END IF;

  SELECT * INTO v_madre FROM public.titoli WHERE id = v_app.titolo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Polizza madre non trovata'; END IF;

  v_base_numero := split_part(v_madre.numero_titolo, '/', 1);

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_base_numero || '/AM%');
  v_numero_am := v_base_numero || '/AM' || v_seq::text;

  v_perc := COALESCE(
    v_app.percentuale_provvigione,
    CASE WHEN v_madre.premio_netto IS NOT NULL AND v_madre.premio_netto <> 0 AND v_madre.provvigioni_firma IS NOT NULL
      THEN ROUND((v_madre.provvigioni_firma / v_madre.premio_netto * 100.0)::numeric, 4)
      ELSE NULL
    END
  );
  v_prov := COALESCE(v_app.provvigioni,
            CASE WHEN v_perc IS NOT NULL AND v_app.premio_netto IS NOT NULL
                 THEN ROUND((v_app.premio_netto * v_perc / 100.0)::numeric, 2)
                 ELSE 0 END);

  INSERT INTO public.titoli (
    numero_titolo, riga, stato, is_appendice_modifica, appendice_modifica_polizza_madre_id,
    cliente_id, cliente_anagrafica_id,
    prodotto_id, prodotto_nome,
    ufficio_id, produttore_id, produttore_nome,
    compagnia_id, compagnia_rapporto_id, codice_rapporto,
    ramo_id, specialist,
    commerciale_id, anagrafica_commerciale_id,
    percentuale_commerciale, percentuale_riparto, tipo_mandatario,
    ae_anagrafica_id, ae_nome,
    descrizione_polizza,
    durata_da, durata_a, data_scadenza, data_competenza,
    garanzia_da, garanzia_a,
    premio_netto, tasse, premio_lordo,
    provvigioni_firma, provvigioni_quietanza,
    tipo_portafoglio
  ) VALUES (
    v_numero_am, 1, 'attivo', true, v_madre.id,
    v_madre.cliente_id, v_madre.cliente_anagrafica_id,
    v_madre.prodotto_id, v_madre.prodotto_nome,
    v_madre.ufficio_id, v_madre.produttore_id, v_madre.produttore_nome,
    v_madre.compagnia_id, v_madre.compagnia_rapporto_id, v_madre.codice_rapporto,
    v_madre.ramo_id, v_madre.specialist,
    v_madre.commerciale_id, v_madre.anagrafica_commerciale_id,
    v_madre.percentuale_commerciale, v_madre.percentuale_riparto, v_madre.tipo_mandatario,
    v_madre.ae_anagrafica_id, v_madre.ae_nome,
    'Modifica - ' || COALESCE(v_app.oggetto, v_madre.descrizione_polizza, ''),
    COALESCE(v_app.data_effetto, v_madre.garanzia_da),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.data_scadenza),
    COALESCE(v_app.data_effetto, v_madre.garanzia_da),
    COALESCE(v_app.data_effetto, v_madre.garanzia_da),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.premio_netto, 0),
    COALESCE(v_app.tasse, 0),
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto, 0) + COALESCE(v_app.tasse, 0)),
    v_prov, v_prov,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  UPDATE public.appendici_polizza
     SET titolo_modifica_id = v_new_id,
         provvigioni = v_prov,
         percentuale_provvigione = v_perc
   WHERE id = p_appendice_id;

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);
  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) crea_titolo_da_proroga: no percentuale_provvigione, usa provvigioni_quietanza
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crea_titolo_da_proroga(p_appendice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_madre record;
  v_new_id uuid;
  v_numero_pr text;
  v_seq int;
  v_perc numeric;
  v_prov numeric;
  v_base_numero text;
BEGIN
  SELECT * INTO v_app FROM public.appendici_polizza WHERE id = p_appendice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appendice % non trovata', p_appendice_id; END IF;
  IF v_app.tipo <> 'proroga' THEN RAISE EXCEPTION 'Appendice non è di tipo proroga'; END IF;
  IF v_app.titolo_proroga_id IS NOT NULL THEN
    PERFORM public.fn_collega_quietanza_appendice(v_app.titolo_proroga_id);
    RETURN v_app.titolo_proroga_id;
  END IF;

  SELECT * INTO v_madre FROM public.titoli WHERE id = v_app.titolo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Polizza madre non trovata'; END IF;

  v_base_numero := split_part(v_madre.numero_titolo, '/', 1);

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_base_numero || '/PR%');
  v_numero_pr := v_base_numero || '/PR' || v_seq::text;

  v_perc := COALESCE(
    v_app.percentuale_provvigione,
    CASE WHEN v_madre.premio_netto IS NOT NULL AND v_madre.premio_netto <> 0 AND v_madre.provvigioni_firma IS NOT NULL
      THEN ROUND((v_madre.provvigioni_firma / v_madre.premio_netto * 100.0)::numeric, 4)
      ELSE NULL
    END
  );
  v_prov := COALESCE(v_app.provvigioni,
            CASE WHEN v_perc IS NOT NULL AND v_app.premio_netto IS NOT NULL
                 THEN ROUND((v_app.premio_netto * v_perc / 100.0)::numeric, 2)
                 ELSE 0 END);

  INSERT INTO public.titoli (
    numero_titolo, riga, stato, is_proroga, proroga_polizza_madre_id,
    cliente_id, cliente_anagrafica_id,
    prodotto_id, prodotto_nome,
    ufficio_id, produttore_id, produttore_nome,
    compagnia_id, compagnia_rapporto_id, codice_rapporto,
    ramo_id, specialist,
    commerciale_id, anagrafica_commerciale_id,
    percentuale_commerciale, percentuale_riparto, tipo_mandatario,
    ae_anagrafica_id, ae_nome,
    descrizione_polizza,
    durata_da, durata_a, data_scadenza, data_competenza,
    garanzia_da, garanzia_a,
    premio_netto, tasse, premio_lordo,
    provvigioni_firma, provvigioni_quietanza,
    tipo_portafoglio
  ) VALUES (
    v_numero_pr, 1, 'attivo', true, v_madre.id,
    v_madre.cliente_id, v_madre.cliente_anagrafica_id,
    v_madre.prodotto_id, v_madre.prodotto_nome,
    v_madre.ufficio_id, v_madre.produttore_id, v_madre.produttore_nome,
    v_madre.compagnia_id, v_madre.compagnia_rapporto_id, v_madre.codice_rapporto,
    v_madre.ramo_id, v_madre.specialist,
    v_madre.commerciale_id, v_madre.anagrafica_commerciale_id,
    v_madre.percentuale_commerciale, v_madre.percentuale_riparto, v_madre.tipo_mandatario,
    v_madre.ae_anagrafica_id, v_madre.ae_nome,
    'Proroga - ' || COALESCE(v_app.oggetto, v_madre.descrizione_polizza, ''),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.data_scadenza),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.premio_netto, 0),
    COALESCE(v_app.tasse, 0),
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto, 0) + COALESCE(v_app.tasse, 0)),
    v_prov, v_prov,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  UPDATE public.appendici_polizza
     SET titolo_proroga_id = v_new_id,
         provvigioni = v_prov,
         percentuale_provvigione = v_perc
   WHERE id = p_appendice_id;

  INSERT INTO public.titoli_proroghe (
    titolo_madre_id, titolo_proroga_id,
    data_proroga, periodo_da, periodo_a,
    premio_lordo, note, created_by
  ) VALUES (
    v_madre.id, v_new_id,
    COALESCE(v_app.data_appendice, CURRENT_DATE),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.premio_lordo, 0),
    v_app.note, v_app.created_by
  );

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);
  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) crea_titolo_da_regolazione: no percentuale_provvigione, usa provvigioni_quietanza
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crea_titolo_da_regolazione(p_appendice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_q record;
  v_madre record;
  v_new_id uuid;
  v_numero_rg text;
  v_seq int;
  v_perc numeric;
  v_prov numeric;
BEGIN
  SELECT * INTO v_app FROM public.appendici_polizza WHERE id = p_appendice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appendice % non trovata', p_appendice_id; END IF;
  IF v_app.tipo <> 'regolazione' THEN RAISE EXCEPTION 'Appendice non è di tipo regolazione'; END IF;
  IF v_app.titolo_regolazione_id IS NOT NULL THEN
    PERFORM public.fn_collega_quietanza_appendice(v_app.titolo_regolazione_id);
    RETURN v_app.titolo_regolazione_id;
  END IF;
  IF v_app.quietanza_id IS NULL THEN RAISE EXCEPTION 'quietanza_id mancante'; END IF;

  SELECT * INTO v_q FROM public.titoli WHERE id = v_app.quietanza_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quietanza % non trovata', v_app.quietanza_id; END IF;

  SELECT * INTO v_madre FROM public.titoli
    WHERE numero_titolo = v_q.numero_titolo AND sostituisce_polizza IS NULL
    LIMIT 1;
  IF NOT FOUND THEN v_madre := v_q; END IF;

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_madre.numero_titolo || '/RG%');
  v_numero_rg := split_part(v_madre.numero_titolo, '/', 1) || '/RG' || v_seq::text;

  v_perc := COALESCE(v_app.percentuale_provvigione, v_madre.percentuale_provvigione);
  v_prov := COALESCE(v_app.provvigioni,
            CASE WHEN v_perc IS NOT NULL AND v_app.premio_netto IS NOT NULL
                 THEN ROUND((v_app.premio_netto * v_perc / 100.0)::numeric, 2)
                 ELSE 0 END);

  INSERT INTO public.titoli (
    numero_titolo, riga, stato, is_regolazione, regolazione_quietanza_id,
    cliente_id, cliente_anagrafica_id,
    prodotto_id, prodotto_nome,
    ufficio_id, produttore_id, produttore_nome,
    compagnia_id, compagnia_rapporto_id, codice_rapporto,
    ramo_id, specialist,
    commerciale_id, anagrafica_commerciale_id,
    percentuale_commerciale, percentuale_riparto, tipo_mandatario,
    ae_anagrafica_id, ae_nome,
    descrizione_polizza,
    durata_da, durata_a, data_scadenza, data_competenza,
    garanzia_da, garanzia_a,
    premio_netto, tasse, premio_lordo,
    provvigioni_firma, provvigioni_quietanza,
    tipo_portafoglio
  ) VALUES (
    v_numero_rg, 1, 'attivo', true, v_q.id,
    v_madre.cliente_id, v_madre.cliente_anagrafica_id,
    v_madre.prodotto_id, v_madre.prodotto_nome,
    v_madre.ufficio_id, v_madre.produttore_id, v_madre.produttore_nome,
    v_madre.compagnia_id, v_madre.compagnia_rapporto_id, v_madre.codice_rapporto,
    v_madre.ramo_id, v_madre.specialist,
    v_madre.commerciale_id, v_madre.anagrafica_commerciale_id,
    v_madre.percentuale_commerciale, v_madre.percentuale_riparto, v_madre.tipo_mandatario,
    v_madre.ae_anagrafica_id, v_madre.ae_nome,
    'Regolazione premio - ' || COALESCE(v_app.oggetto, v_madre.descrizione_polizza, ''),
    COALESCE(v_app.data_effetto, v_q.garanzia_da),
    COALESCE(v_app.data_appendice, v_q.garanzia_a),
    COALESCE(v_app.data_appendice, v_q.data_scadenza),
    COALESCE(v_app.data_effetto, v_q.garanzia_da),
    COALESCE(v_app.data_effetto, v_q.garanzia_da),
    COALESCE(v_app.data_appendice, v_q.garanzia_a),
    COALESCE(v_app.premio_netto, 0),
    COALESCE(v_app.tasse, 0),
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto, 0) + COALESCE(v_app.tasse, 0)),
    v_prov, v_prov,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  UPDATE public.appendici_polizza
     SET titolo_regolazione_id = v_new_id,
         provvigioni = v_prov,
         percentuale_provvigione = v_perc
   WHERE id = p_appendice_id;

  INSERT INTO public.titoli_regolazioni (
    titolo_madre_id, titolo_regolazione_id, quietanza_riferimento_id,
    data_regolazione, periodo_da, periodo_a,
    imponibile_consuntivo, conguaglio_premio, note, created_by
  ) VALUES (
    v_madre.id, v_new_id, v_q.id,
    COALESCE(v_app.data_appendice, CURRENT_DATE),
    v_q.garanzia_da, v_q.garanzia_a,
    COALESCE(v_app.premio_netto, 0),
    COALESCE(v_app.premio_lordo, 0),
    v_app.note, v_app.created_by
  );

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);
  RETURN v_new_id;
END;
$$;
