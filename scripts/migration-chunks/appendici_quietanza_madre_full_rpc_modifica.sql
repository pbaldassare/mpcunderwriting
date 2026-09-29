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
    provvigioni_firma, percentuale_provvigione,
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
    v_prov, v_perc,
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