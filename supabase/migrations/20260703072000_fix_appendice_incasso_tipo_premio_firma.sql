-- Fix: la RPC crea_appendice_incasso inseriva le righe premi con tipo_premio='rata',
-- ma il CHECK premi_garanzia_polizza_tipo_premio_check ammette solo 'firma'|'quietanza'.
-- Le righe base di un titolo usano 'firma' (è il valore che TitoloImportiPremiBlock
-- filtra per la composizione firma). Usiamo quindi 'firma' anche per il titolo-incasso
-- dell'appendice.

CREATE OR REPLACE FUNCTION public.crea_appendice_incasso(
  p_titolo_id uuid,
  p_tipo text,
  p_numero_appendice text,
  p_data_effetto date,
  p_data_scadenza date,
  p_oggetto text,
  p_note text,
  p_quietanza_id uuid,
  p_premio_netto numeric,
  p_tasse numeric,
  p_addizionali numeric,
  p_ssn numeric,
  p_premio_lordo numeric,
  p_provvigioni numeric,
  p_percentuale_provvigione numeric,
  p_garanzie jsonb,
  p_file_path text,
  p_nome_file text,
  p_allegati jsonb,
  p_created_by uuid
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_madre record;
  v_q record;
  v_app_id uuid;
  v_new_id uuid;
  v_base_numero text;
  v_suffix text;
  v_seq int;
  v_numero text;
  v_perc numeric;
  v_prov numeric;
  v_q_id uuid := NULL;
  v_eff date;
  v_scad date;
  v_desc_prefix text;
  v_g jsonb;
  v_ord int := 0;
BEGIN
  IF p_tipo NOT IN ('modifica','proroga','regolazione') THEN
    RAISE EXCEPTION 'Tipo appendice non valido: %', p_tipo;
  END IF;
  IF p_data_effetto IS NULL THEN
    RAISE EXCEPTION 'Data effetto obbligatoria';
  END IF;

  IF p_tipo = 'regolazione' THEN
    IF p_quietanza_id IS NULL THEN RAISE EXCEPTION 'Quietanza di riferimento obbligatoria'; END IF;
    SELECT * INTO v_q FROM public.titoli WHERE id = p_quietanza_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Quietanza % non trovata', p_quietanza_id; END IF;
    v_q_id := v_q.id;
    SELECT * INTO v_madre FROM public.titoli
      WHERE numero_titolo = v_q.numero_titolo AND sostituisce_polizza IS NULL
      LIMIT 1;
    IF NOT FOUND THEN v_madre := v_q; END IF;
  ELSE
    SELECT * INTO v_madre FROM public.titoli WHERE id = p_titolo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Polizza madre % non trovata', p_titolo_id; END IF;
  END IF;

  v_base_numero := split_part(v_madre.numero_titolo, '/', 1);
  v_suffix := CASE p_tipo WHEN 'modifica' THEN 'AM' WHEN 'proroga' THEN 'PR' ELSE 'RG' END;

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_base_numero || '/' || v_suffix || '%');
  v_numero := v_base_numero || '/' || v_suffix || v_seq::text;

  v_perc := COALESCE(
    p_percentuale_provvigione,
    CASE WHEN v_madre.premio_netto IS NOT NULL AND v_madre.premio_netto <> 0 AND v_madre.provvigioni_firma IS NOT NULL
      THEN ROUND((v_madre.provvigioni_firma / v_madre.premio_netto * 100.0)::numeric, 4)
      ELSE NULL END
  );
  v_prov := COALESCE(p_provvigioni,
    CASE WHEN v_perc IS NOT NULL AND p_premio_netto IS NOT NULL
      THEN ROUND((p_premio_netto * v_perc / 100.0)::numeric, 2) ELSE 0 END);

  IF p_tipo = 'proroga' THEN
    v_eff := COALESCE(p_data_effetto, v_madre.garanzia_a);
  ELSIF p_tipo = 'regolazione' THEN
    v_eff := COALESCE(p_data_effetto, v_q.garanzia_da);
  ELSE
    v_eff := p_data_effetto;
  END IF;
  v_scad := p_data_scadenza;

  v_desc_prefix := CASE p_tipo
    WHEN 'modifica' THEN 'Modifica - '
    WHEN 'proroga' THEN 'Proroga - '
    ELSE 'Regolazione premio - ' END;

  INSERT INTO public.appendici_polizza (
    titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, tipo,
    file_path, nome_file, allegati, note, created_by,
    quietanza_id, premio_netto, tasse, addizionali, ssn, premio_lordo,
    provvigioni, percentuale_provvigione
  ) VALUES (
    v_madre.id, p_numero_appendice, v_scad, v_eff, NULLIF(TRIM(COALESCE(p_oggetto,'')),''), p_tipo,
    p_file_path, p_nome_file, COALESCE(p_allegati, '[]'::jsonb), NULLIF(TRIM(COALESCE(p_note,'')),''), p_created_by,
    CASE WHEN p_tipo = 'regolazione' THEN p_quietanza_id ELSE NULL END,
    COALESCE(p_premio_netto,0), COALESCE(p_tasse,0), COALESCE(p_addizionali,0), COALESCE(p_ssn,0),
    COALESCE(p_premio_lordo, COALESCE(p_premio_netto,0)+COALESCE(p_tasse,0)+COALESCE(p_addizionali,0)+COALESCE(p_ssn,0)),
    v_prov, v_perc
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.titoli (
    numero_titolo, riga, stato,
    is_appendice_modifica, appendice_modifica_polizza_madre_id,
    is_proroga, proroga_polizza_madre_id,
    is_regolazione, regolazione_quietanza_id,
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
    premio_netto, tasse, ssn_firma, addizionali, premio_lordo,
    provvigioni_firma, provvigioni_quietanza,
    tipo_portafoglio
  ) VALUES (
    v_numero, 1, 'attivo',
    (p_tipo = 'modifica'),    CASE WHEN p_tipo = 'modifica'   THEN v_madre.id ELSE NULL END,
    (p_tipo = 'proroga'),     CASE WHEN p_tipo = 'proroga'    THEN v_madre.id ELSE NULL END,
    (p_tipo = 'regolazione'), v_q_id,
    v_madre.cliente_id, v_madre.cliente_anagrafica_id,
    v_madre.prodotto_id, v_madre.prodotto_nome,
    v_madre.ufficio_id, v_madre.produttore_id, v_madre.produttore_nome,
    v_madre.compagnia_id, v_madre.compagnia_rapporto_id, v_madre.codice_rapporto,
    v_madre.ramo_id, v_madre.specialist,
    v_madre.commerciale_id, v_madre.anagrafica_commerciale_id,
    v_madre.percentuale_commerciale, v_madre.percentuale_riparto, v_madre.tipo_mandatario,
    v_madre.ae_anagrafica_id, v_madre.ae_nome,
    v_desc_prefix || COALESCE(NULLIF(TRIM(COALESCE(p_oggetto,'')),''), v_madre.descrizione_polizza, ''),
    v_eff, v_scad, v_scad, v_eff,
    v_eff, v_scad,
    COALESCE(p_premio_netto,0), COALESCE(p_tasse,0), COALESCE(p_ssn,0), COALESCE(p_addizionali,0),
    COALESCE(p_premio_lordo, COALESCE(p_premio_netto,0)+COALESCE(p_tasse,0)+COALESCE(p_addizionali,0)+COALESCE(p_ssn,0)),
    v_prov, v_prov,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  IF p_garanzie IS NOT NULL AND jsonb_typeof(p_garanzie) = 'array' THEN
    FOR v_g IN SELECT * FROM jsonb_array_elements(p_garanzie) LOOP
      v_ord := v_ord + 1;
      INSERT INTO public.premi_garanzia_polizza (
        titolo_id, garanzia, codice_garanzia,
        firma, rata, imposta_provinciale, ssn, accessori,
        aliquota_tasse_pct, lordo_calcolato, is_rca_principale, ordine, tipo_premio
      ) VALUES (
        v_new_id,
        COALESCE(v_g->>'garanzia', 'Garanzia'),
        NULLIF(v_g->>'codice_garanzia',''),
        COALESCE((v_g->>'firma')::numeric, 0),
        COALESCE((v_g->>'rata')::numeric, 0),
        COALESCE((v_g->>'imposta_provinciale')::numeric, 0),
        COALESCE((v_g->>'ssn')::numeric, 0),
        COALESCE((v_g->>'accessori')::numeric, 0),
        NULLIF(v_g->>'aliquota_tasse_pct','')::numeric,
        COALESCE((v_g->>'lordo_calcolato')::numeric, 0),
        COALESCE((v_g->>'is_rca_principale')::boolean, false),
        COALESCE((v_g->>'ordine')::int, v_ord),
        'firma'
      );
    END LOOP;
  END IF;

  UPDATE public.appendici_polizza SET
    titolo_modifica_id   = CASE WHEN p_tipo = 'modifica'    THEN v_new_id ELSE titolo_modifica_id END,
    titolo_proroga_id    = CASE WHEN p_tipo = 'proroga'     THEN v_new_id ELSE titolo_proroga_id END,
    titolo_regolazione_id= CASE WHEN p_tipo = 'regolazione' THEN v_new_id ELSE titolo_regolazione_id END
  WHERE id = v_app_id;

  IF p_tipo = 'proroga' THEN
    INSERT INTO public.titoli_proroghe (
      titolo_madre_id, titolo_proroga_id, data_proroga, periodo_da, periodo_a,
      premio_lordo, note, created_by
    ) VALUES (
      v_madre.id, v_new_id, COALESCE(v_scad, CURRENT_DATE), v_eff, v_scad,
      COALESCE(p_premio_lordo, 0), NULLIF(TRIM(COALESCE(p_note,'')),''), p_created_by
    );
  ELSIF p_tipo = 'regolazione' THEN
    INSERT INTO public.titoli_regolazioni (
      titolo_madre_id, titolo_regolazione_id, quietanza_riferimento_id,
      data_regolazione, periodo_da, periodo_a,
      imponibile_consuntivo, conguaglio_premio, note, created_by
    ) VALUES (
      v_madre.id, v_new_id, v_q.id, COALESCE(v_scad, CURRENT_DATE),
      v_q.garanzia_da, v_q.garanzia_a,
      COALESCE(p_premio_netto, 0), COALESCE(p_premio_lordo, 0),
      NULLIF(TRIM(COALESCE(p_note,'')),''), p_created_by
    );
  END IF;

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);

  RETURN jsonb_build_object('appendice_id', v_app_id, 'titolo_id', v_new_id, 'numero_titolo', v_numero);
END;
$$;
