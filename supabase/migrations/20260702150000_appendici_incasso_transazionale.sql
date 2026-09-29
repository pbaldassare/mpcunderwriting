-- Appendici AM/PR/RG come titoli-incasso: creazione atomica (header + titolo + premi + quietanza),
-- scadenza opzionale (modifica), isolamento dalla logica quietanze (no rate generate), bonifica orfane.

-- ---------------------------------------------------------------------------
-- 1) Header appendice: componenti premio complete (addizionali + ssn)
-- ---------------------------------------------------------------------------
ALTER TABLE public.appendici_polizza
  ADD COLUMN IF NOT EXISTS addizionali numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ssn numeric(14,2) DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2) genera_quietanze_su_insert_madre: NON generare rate per AM/PR/RG
--    (guard aggiuntivo; il resto della logica rateo/standard resta invariato)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.genera_quietanze_su_insert_madre()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months_period int;
  v_anni int;
  v_n_rate int;
  v_i int;
  v_frazionamento text;
  v_prev_riga int := COALESCE(NEW.riga, 1);
  v_gar_da date; v_gar_a date;
  v_dur_da date; v_dur_a date;
  v_competenza date; v_scadenza date;
  v_new_id uuid; v_new_riga int;
  v_temporanea boolean := COALESCE(NEW.polizza_temporanea, false);
  v_rateo boolean := COALESCE(NEW.polizza_rateo, false);
  v_durata_fine date;
  v_premio_lordo_f numeric;
  v_premio_lordo_q numeric;
BEGIN
  IF NEW.sostituisce_polizza IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_regolazione, false) THEN RETURN NEW; END IF;
  -- Appendici (modifica/proroga): sono titoli-incasso autonomi, non generano rate
  IF COALESCE(NEW.is_appendice_modifica, false) OR COALESCE(NEW.is_proroga, false) THEN RETURN NEW; END IF;
  IF NEW.numero_titolo IS NULL THEN RETURN NEW; END IF;
  IF NEW.garanzia_da IS NULL OR NEW.garanzia_a IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
     WHERE sostituisce_polizza = NEW.numero_titolo
       AND COALESCE(is_regolazione, false) = false
  ) THEN RETURN NEW; END IF;

  IF v_temporanea THEN
    v_new_riga := v_prev_riga + 1;

    INSERT INTO public.titoli (
      numero_titolo, riga, stato,
      cliente_id, cliente_anagrafica_id,
      prodotto_id, prodotto_nome,
      ufficio_id, produttore_id, produttore_nome,
      compagnia_id, compagnia_rapporto_id, codice_rapporto,
      ramo_id, specialist,
      commerciale_id, anagrafica_commerciale_id,
      percentuale_commerciale, percentuale_riparto, tipo_mandatario,
      ae_anagrafica_id, ae_nome,
      anni_durata, rate, periodicita, frazionamento,
      tipo_rinnovo, tacito_rinnovo, disdetta_mesi,
      descrizione_polizza, targa_telaio, risk_type,
      valuta, cambio, indicizzata, no_calcolo_tasse,
      durata_da, durata_a, data_scadenza, data_competenza,
      garanzia_da, garanzia_a,
      premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
      premio_netto_quietanza, tasse_quietanza, ssn_quietanza, addizionali_quietanza, provvigioni_quietanza,
      premio_lordo,
      sostituisce_polizza, sostituisce_riga,
      tipo_portafoglio,
      polizza_temporanea, polizza_rateo
    ) VALUES (
      NEW.numero_titolo, v_new_riga, 'attivo',
      NEW.cliente_id, NEW.cliente_anagrafica_id,
      NEW.prodotto_id, NEW.prodotto_nome,
      NEW.ufficio_id, NEW.produttore_id, NEW.produttore_nome,
      NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
      NEW.ramo_id, NEW.specialist,
      NEW.commerciale_id, NEW.anagrafica_commerciale_id,
      NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
      NEW.ae_anagrafica_id, NEW.ae_nome,
      NEW.anni_durata, 1, NEW.periodicita, NULL,
      NEW.tipo_rinnovo, false, NEW.disdetta_mesi,
      NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
      NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
      COALESCE(NEW.durata_da, NEW.garanzia_da), COALESCE(NEW.durata_a, NEW.garanzia_a),
      COALESCE(NEW.data_scadenza, NEW.garanzia_a), COALESCE(NEW.data_competenza, NEW.garanzia_da),
      NEW.garanzia_da, NEW.garanzia_a,
      COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
      COALESCE(NEW.tasse_quietanza, NEW.tasse),
      COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
      COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
      COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
      COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
      COALESCE(NEW.tasse_quietanza, NEW.tasse),
      COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
      COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
      COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
      NEW.premio_lordo,
      NEW.numero_titolo, v_prev_riga,
      NEW.tipo_portafoglio,
      true, false
    ) RETURNING id INTO v_new_id;

    RETURN NEW;
  END IF;

  v_frazionamento := COALESCE(NEW.frazionamento, '');
  v_months_period := CASE LOWER(v_frazionamento)
    WHEN 'mensile' THEN 1 WHEN 'trimestrale' THEN 3 WHEN 'quadrimestrale' THEN 4
    WHEN 'semestrale' THEN 6 WHEN 'annuale' THEN 12 WHEN 'poliennale' THEN 0
    ELSE 0 END;

  IF v_rateo THEN
    IF v_months_period = 0 THEN RETURN NEW; END IF;
    v_durata_fine := COALESCE(NEW.durata_a, NEW.garanzia_a);
    v_dur_da := COALESCE(NEW.durata_da, NEW.garanzia_da);
    v_dur_a := v_durata_fine;

    -- Q1 rateo: periodo garanzia_da→garanzia_a + importi FIRMA
    v_gar_da := NEW.garanzia_da;
    v_gar_a := NEW.garanzia_a;
    v_competenza := COALESCE(NEW.data_competenza, NEW.garanzia_da);
    v_scadenza := COALESCE(NEW.data_scadenza, v_gar_a);
    v_new_riga := v_prev_riga + 1;

    v_premio_lordo_f := COALESCE(NEW.premio_netto, 0)
      + COALESCE(NEW.tasse, 0)
      + COALESCE(NEW.addizionali, 0)
      + COALESCE(NEW.ssn_firma, 0);

    INSERT INTO public.titoli (
      numero_titolo, riga, stato,
      cliente_id, cliente_anagrafica_id,
      prodotto_id, prodotto_nome,
      ufficio_id, produttore_id, produttore_nome,
      compagnia_id, compagnia_rapporto_id, codice_rapporto,
      ramo_id, specialist,
      commerciale_id, anagrafica_commerciale_id,
      percentuale_commerciale, percentuale_riparto, tipo_mandatario,
      ae_anagrafica_id, ae_nome,
      anni_durata, rate, periodicita, frazionamento,
      tipo_rinnovo, tacito_rinnovo, disdetta_mesi,
      descrizione_polizza, targa_telaio, risk_type,
      valuta, cambio, indicizzata, no_calcolo_tasse,
      durata_da, durata_a, data_scadenza, data_competenza,
      garanzia_da, garanzia_a,
      premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
      premio_netto_quietanza, tasse_quietanza, ssn_quietanza, addizionali_quietanza, provvigioni_quietanza,
      premio_lordo,
      sostituisce_polizza, sostituisce_riga,
      tipo_portafoglio,
      polizza_temporanea, polizza_rateo
    ) VALUES (
      NEW.numero_titolo, v_new_riga, 'attivo',
      NEW.cliente_id, NEW.cliente_anagrafica_id,
      NEW.prodotto_id, NEW.prodotto_nome,
      NEW.ufficio_id, NEW.produttore_id, NEW.produttore_nome,
      NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
      NEW.ramo_id, NEW.specialist,
      NEW.commerciale_id, NEW.anagrafica_commerciale_id,
      NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
      NEW.ae_anagrafica_id, NEW.ae_nome,
      NEW.anni_durata, NEW.rate, NEW.periodicita, NEW.frazionamento,
      NEW.tipo_rinnovo, NEW.tacito_rinnovo, NEW.disdetta_mesi,
      NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
      NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
      v_dur_da, v_dur_a, v_scadenza, v_competenza,
      v_gar_da, v_gar_a,
      NEW.premio_netto,
      NEW.tasse,
      NEW.ssn_firma,
      NEW.addizionali,
      NEW.provvigioni_firma,
      NEW.premio_netto,
      NEW.tasse,
      NEW.ssn_firma,
      NEW.addizionali,
      NEW.provvigioni_firma,
      v_premio_lordo_f,
      NEW.numero_titolo, v_prev_riga,
      NEW.tipo_portafoglio,
      false, true
    ) RETURNING id INTO v_new_id;

    v_prev_riga := v_new_riga;

    v_premio_lordo_q := COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto, 0)
      + COALESCE(NEW.tasse_quietanza, NEW.tasse, 0)
      + COALESCE(NEW.addizionali_quietanza, NEW.addizionali, 0)
      + COALESCE(NEW.ssn_quietanza, NEW.ssn_firma, 0);

    -- Q2+ annualità: da garanzia_a (stesso giorno, transizione 24:00) fino a durata_a + importi QUIETANZA
    v_gar_da := NEW.garanzia_a;
    WHILE v_gar_da < v_durata_fine LOOP
      v_gar_a := (v_gar_da + (v_months_period || ' months')::interval)::date;
      IF v_gar_a > v_durata_fine THEN
        v_gar_a := v_durata_fine;
      END IF;
      v_competenza := v_gar_da;
      v_scadenza := v_gar_a;
      v_new_riga := v_prev_riga + 1;

      INSERT INTO public.titoli (
        numero_titolo, riga, stato,
        cliente_id, cliente_anagrafica_id,
        prodotto_id, prodotto_nome,
        ufficio_id, produttore_id, produttore_nome,
        compagnia_id, compagnia_rapporto_id, codice_rapporto,
        ramo_id, specialist,
        commerciale_id, anagrafica_commerciale_id,
        percentuale_commerciale, percentuale_riparto, tipo_mandatario,
        ae_anagrafica_id, ae_nome,
        anni_durata, rate, periodicita, frazionamento,
        tipo_rinnovo, tacito_rinnovo, disdetta_mesi,
        descrizione_polizza, targa_telaio, risk_type,
        valuta, cambio, indicizzata, no_calcolo_tasse,
        durata_da, durata_a, data_scadenza, data_competenza,
        garanzia_da, garanzia_a,
        premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
        premio_netto_quietanza, tasse_quietanza, ssn_quietanza, addizionali_quietanza, provvigioni_quietanza,
        premio_lordo,
        sostituisce_polizza, sostituisce_riga,
        tipo_portafoglio,
        polizza_temporanea, polizza_rateo
      ) VALUES (
        NEW.numero_titolo, v_new_riga, 'attivo',
        NEW.cliente_id, NEW.cliente_anagrafica_id,
        NEW.prodotto_id, NEW.prodotto_nome,
        NEW.ufficio_id, NEW.produttore_id, NEW.produttore_nome,
        NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
        NEW.ramo_id, NEW.specialist,
        NEW.commerciale_id, NEW.anagrafica_commerciale_id,
        NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
        NEW.ae_anagrafica_id, NEW.ae_nome,
        NEW.anni_durata, NEW.rate, NEW.periodicita, NEW.frazionamento,
        NEW.tipo_rinnovo, NEW.tacito_rinnovo, NEW.disdetta_mesi,
        NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
        NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
        v_dur_da, v_dur_a, v_scadenza, v_competenza,
        v_gar_da, v_gar_a,
        COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
        COALESCE(NEW.tasse_quietanza, NEW.tasse),
        COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
        COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
        COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
        COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
        COALESCE(NEW.tasse_quietanza, NEW.tasse),
        COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
        COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
        COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
        v_premio_lordo_q,
        NEW.numero_titolo, v_prev_riga,
        NEW.tipo_portafoglio,
        false, true
      ) RETURNING id INTO v_new_id;

      EXIT WHEN v_gar_a >= v_durata_fine;
      v_gar_da := v_gar_a;
      v_prev_riga := v_new_riga;
    END LOOP;

    -- Madre = shell contratto: garanzia = durata contratto, premi azzerati
    UPDATE public.titoli SET
      garanzia_da = COALESCE(NEW.durata_da, NEW.garanzia_da),
      garanzia_a = COALESCE(NEW.durata_a, NEW.garanzia_a),
      premio_netto = 0,
      tasse = 0,
      ssn_firma = 0,
      addizionali = 0,
      provvigioni_firma = 0,
      premio_lordo = 0,
      premio_netto_quietanza = 0,
      tasse_quietanza = 0,
      ssn_quietanza = 0,
      addizionali_quietanza = 0,
      provvigioni_quietanza = 0,
      brokeraggio_firma = 0,
      brokeraggio_quietanza = 0
    WHERE id = NEW.id;

    RETURN NEW;
  END IF;

  IF v_months_period = 0 THEN RETURN NEW; END IF;

  v_anni := GREATEST(1, COALESCE(NEW.anni_durata, 1));
  v_n_rate := (12 / v_months_period) * v_anni;
  IF v_n_rate < 1 THEN RETURN NEW; END IF;

  FOR v_i IN 1..v_n_rate LOOP
    v_gar_da := (NEW.garanzia_da + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    v_gar_a  := (v_gar_da + (v_months_period || ' months')::interval)::date;
    IF NEW.durata_da IS NOT NULL THEN
      v_dur_da := (NEW.durata_da + ((v_i - 1) * v_months_period || ' months')::interval)::date;
      v_dur_a  := (v_dur_da + (v_months_period || ' months')::interval)::date;
    ELSE
      v_dur_da := v_gar_da; v_dur_a := v_gar_a;
    END IF;
    IF NEW.data_competenza IS NOT NULL THEN
      v_competenza := (NEW.data_competenza + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    ELSE v_competenza := v_gar_da; END IF;
    IF NEW.data_scadenza IS NOT NULL THEN
      v_scadenza := (NEW.data_scadenza + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    ELSE v_scadenza := v_dur_a; END IF;

    v_new_riga := v_prev_riga + 1;

    INSERT INTO public.titoli (
      numero_titolo, riga, stato,
      cliente_id, cliente_anagrafica_id,
      prodotto_id, prodotto_nome,
      ufficio_id, produttore_id, produttore_nome,
      compagnia_id, compagnia_rapporto_id, codice_rapporto,
      ramo_id, specialist,
      commerciale_id, anagrafica_commerciale_id,
      percentuale_commerciale, percentuale_riparto, tipo_mandatario,
      ae_anagrafica_id, ae_nome,
      anni_durata, rate, periodicita, frazionamento,
      tipo_rinnovo, tacito_rinnovo, disdetta_mesi,
      descrizione_polizza, targa_telaio, risk_type,
      valuta, cambio, indicizzata, no_calcolo_tasse,
      durata_da, durata_a, data_scadenza, data_competenza,
      garanzia_da, garanzia_a,
      premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
      premio_netto_quietanza, tasse_quietanza, ssn_quietanza, addizionali_quietanza, provvigioni_quietanza,
      premio_lordo,
      sostituisce_polizza, sostituisce_riga,
      tipo_portafoglio,
      polizza_temporanea, polizza_rateo
    ) VALUES (
      NEW.numero_titolo, v_new_riga, 'attivo',
      NEW.cliente_id, NEW.cliente_anagrafica_id,
      NEW.prodotto_id, NEW.prodotto_nome,
      NEW.ufficio_id, NEW.produttore_id, NEW.produttore_nome,
      NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
      NEW.ramo_id, NEW.specialist,
      NEW.commerciale_id, NEW.anagrafica_commerciale_id,
      NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
      NEW.ae_anagrafica_id, NEW.ae_nome,
      NEW.anni_durata, NEW.rate, NEW.periodicita, NEW.frazionamento,
      NEW.tipo_rinnovo, NEW.tacito_rinnovo, NEW.disdetta_mesi,
      NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
      NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
      v_dur_da, v_dur_a, v_scadenza, v_competenza,
      v_gar_da, v_gar_a,
      COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
      COALESCE(NEW.tasse_quietanza, NEW.tasse),
      COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
      COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
      COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
      COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
      COALESCE(NEW.tasse_quietanza, NEW.tasse),
      COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
      COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
      COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
      NEW.premio_lordo,
      NEW.numero_titolo, v_prev_riga,
      NEW.tipo_portafoglio,
      false, false
    ) RETURNING id INTO v_new_id;

    v_prev_riga := v_new_riga;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3) RPC transazionale unica: crea header + titolo-incasso + premi + quietanza
--    tipo: 'modifica' | 'proroga' | 'regolazione'. Scadenza opzionale.
-- ---------------------------------------------------------------------------
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

  -- Risoluzione madre (per regolazione parte dalla quietanza di riferimento)
  IF p_tipo = 'regolazione' THEN
    IF p_quietanza_id IS NULL THEN RAISE EXCEPTION 'Quietanza di riferimento obbligatoria'; END IF;
    SELECT * INTO v_q FROM public.titoli WHERE id = p_quietanza_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Quietanza % non trovata', p_quietanza_id; END IF;
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

  -- Periodo: modifica → nessuna scadenza obbligatoria; proroga/regolazione derivano l'effetto se assente
  IF p_tipo = 'proroga' THEN
    v_eff := COALESCE(p_data_effetto, v_madre.garanzia_a);
  ELSIF p_tipo = 'regolazione' THEN
    v_eff := COALESCE(p_data_effetto, v_q.garanzia_da);
  ELSE
    v_eff := p_data_effetto;
  END IF;
  v_scad := p_data_scadenza; -- può restare NULL (modifica)

  v_desc_prefix := CASE p_tipo
    WHEN 'modifica' THEN 'Modifica - '
    WHEN 'proroga' THEN 'Proroga - '
    ELSE 'Regolazione premio - ' END;

  -- Header appendice
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

  -- Titolo-incasso derivato (stato attivo, cassabile anche a 0). Scadenza opzionale.
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
    provvigioni_firma, provvigioni_quietanza, percentuale_provvigione,
    tipo_portafoglio
  ) VALUES (
    v_numero, 1, 'attivo',
    (p_tipo = 'modifica'),    CASE WHEN p_tipo = 'modifica'   THEN v_madre.id ELSE NULL END,
    (p_tipo = 'proroga'),     CASE WHEN p_tipo = 'proroga'    THEN v_madre.id ELSE NULL END,
    (p_tipo = 'regolazione'), CASE WHEN p_tipo = 'regolazione' THEN v_q.id    ELSE NULL END,
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
    v_prov, v_prov, v_perc,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  -- Composizione premi (righe garanzia) sul titolo-incasso
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
        'rata'
      );
    END LOOP;
  END IF;

  -- Aggiorna header con il riferimento al titolo derivato
  UPDATE public.appendici_polizza SET
    titolo_modifica_id   = CASE WHEN p_tipo = 'modifica'    THEN v_new_id ELSE titolo_modifica_id END,
    titolo_proroga_id    = CASE WHEN p_tipo = 'proroga'     THEN v_new_id ELSE titolo_proroga_id END,
    titolo_regolazione_id= CASE WHEN p_tipo = 'regolazione' THEN v_new_id ELSE titolo_regolazione_id END
  WHERE id = v_app_id;

  -- Storico specifico per proroga/regolazione
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

  -- Crea la quietanza-incasso sulla polizza madre con i valori FINALI del titolo
  PERFORM public.fn_collega_quietanza_appendice(v_new_id);

  RETURN jsonb_build_object('appendice_id', v_app_id, 'titolo_id', v_new_id, 'numero_titolo', v_numero);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crea_appendice_incasso(
  uuid, text, text, date, date, text, text, uuid,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  jsonb, text, text, jsonb, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crea_appendice_incasso(
  uuid, text, text, date, date, text, text, uuid,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  jsonb, text, text, jsonb, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Bonifica: elimina header appendice orfani (nessun titolo derivato creato)
-- ---------------------------------------------------------------------------
DELETE FROM public.appendici_polizza
WHERE titolo_modifica_id IS NULL
  AND titolo_proroga_id IS NULL
  AND titolo_regolazione_id IS NULL;
