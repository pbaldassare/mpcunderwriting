-- Fix polizza_rateo: Q1 usa importi firma, Q2+ importi quietanza, madre = shell contratto.
-- Clone premi_garanzia_polizza (firma→Q1, quietanza→Q2+).
-- Skip genera_quietanza_su_messa_cassa se rateo con quietanze pre-generate.
-- Nessuna correzione dati storici (43434343, 184667498).

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

    -- Q2+ annualità: dal giorno dopo garanzia_a fino a durata_a + importi QUIETANZA
    v_gar_da := (NEW.garanzia_a + interval '1 day')::date;
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

COMMENT ON FUNCTION public.genera_quietanze_su_insert_madre() IS
'Pre-genera quietanze all''insert polizza madre. Rateo: Q1=firma, Q2+=quietanza, madre=shell. Temporanea: 1 quietanza. Standard: frazionamento+anni_durata.';

-- Patch messa a cassa: non generare rate spurie su polizza rateo con quietanze pre-create
CREATE OR REPLACE FUNCTION public.genera_quietanza_su_messa_cassa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months_period int;
  v_durata_months int;
  v_is_poliennale boolean := false;
  v_frazionamento text;
  v_base_da date;
  v_new_da date;
  v_new_a date;
  v_gar_offset int;
  v_new_gar_da date;
  v_new_gar_a date;
  v_new_riga int;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  IF NEW.stato <> 'incassato' OR OLD.stato = 'incassato' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_regolazione, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.numero_titolo IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND COALESCE(polizza_temporanea, false) = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip: polizza rateo con quietanze già pre-generate all'immissione
  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND COALESCE(polizza_rateo, false) = true
  ) AND EXISTS (
    SELECT 1 FROM public.titoli
    WHERE sostituisce_polizza = NEW.numero_titolo
      AND COALESCE(is_regolazione, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.garanzia_da IS NOT NULL AND NEW.garanzia_a IS NOT NULL THEN
    v_durata_months := (EXTRACT(YEAR FROM NEW.garanzia_a) - EXTRACT(YEAR FROM NEW.garanzia_da)) * 12
                     + (EXTRACT(MONTH FROM NEW.garanzia_a) - EXTRACT(MONTH FROM NEW.garanzia_da));
    v_is_poliennale := v_durata_months > 13;
  END IF;
  IF v_is_poliennale THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.titoli
  WHERE sostituisce_polizza = NEW.numero_titolo
    AND ((NEW.riga IS NULL AND sostituisce_riga IS NULL) OR sostituisce_riga = NEW.riga)
    AND COALESCE(is_regolazione, false) = false
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_frazionamento := COALESCE(NEW.frazionamento, '');
  v_months_period := CASE LOWER(v_frazionamento)
    WHEN 'mensile' THEN 1
    WHEN 'trimestrale' THEN 3
    WHEN 'quadrimestrale' THEN 4
    WHEN 'semestrale' THEN 6
    WHEN 'annuale' THEN 12
    WHEN 'poliennale' THEN 0
    ELSE 0
  END;

  IF v_months_period = 0 THEN
    IF NEW.rate IS NOT NULL AND NEW.rate > 0 THEN
      v_months_period := GREATEST(1, ROUND(12.0 / NEW.rate)::int);
    ELSE
      v_months_period := 12;
    END IF;
  END IF;

  v_base_da := COALESCE(NEW.durata_a, NEW.data_scadenza);
  IF v_base_da IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_da := v_base_da;
  v_new_a := (v_base_da + (v_months_period || ' months')::interval)::date;

  IF NEW.garanzia_da IS NOT NULL AND NEW.durata_da IS NOT NULL THEN
    v_gar_offset := (NEW.garanzia_da - NEW.durata_da);
    v_new_gar_da := v_new_da + v_gar_offset;
    v_new_gar_a := (v_new_gar_da + (v_months_period || ' months')::interval)::date;
  ELSE
    v_new_gar_da := v_new_da;
    v_new_gar_a := v_new_a;
  END IF;

  SELECT COALESCE(MAX(riga), 0) + 1 INTO v_new_riga
  FROM public.titoli
  WHERE numero_titolo = NEW.numero_titolo
    AND COALESCE(is_regolazione, false) = false;

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
    tipo_portafoglio
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
    v_new_da, v_new_a, COALESCE(v_new_gar_da, v_new_da), v_new_da,
    v_new_gar_da, v_new_gar_a,
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
    NEW.numero_titolo, NEW.riga,
    NEW.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  RETURN NEW;
END;
$function$;

-- Premi garanzia: inseriti dall'app DOPO l'insert madre → clone su quietanze via RPC.
CREATE OR REPLACE FUNCTION public.clone_premi_rateo_su_quietanze(p_madre_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_madre record;
  v_child record;
  v_is_first boolean := true;
BEGIN
  SELECT * INTO v_madre FROM public.titoli WHERE id = p_madre_id;
  IF NOT FOUND OR NOT COALESCE(v_madre.polizza_rateo, false) THEN
    RETURN;
  END IF;
  IF v_madre.sostituisce_polizza IS NOT NULL THEN
    RETURN;
  END IF;

  FOR v_child IN
    SELECT id FROM public.titoli
    WHERE sostituisce_polizza = v_madre.numero_titolo
      AND COALESCE(is_regolazione, false) = false
    ORDER BY riga
  LOOP
    DELETE FROM public.premi_garanzia_polizza WHERE titolo_id = v_child.id;

    IF v_is_first THEN
      INSERT INTO public.premi_garanzia_polizza (
        titolo_id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
        aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
        imposta_provinciale, ssn, codice_garanzia, tipo_premio,
        quietanza_personalizzata, accessori, provvigione_netto_pct, provvigione_accessori_pct
      )
      SELECT
        v_child.id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
        aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
        imposta_provinciale, ssn, codice_garanzia, 'firma',
        quietanza_personalizzata, accessori, provvigione_netto_pct, provvigione_accessori_pct
      FROM public.premi_garanzia_polizza
      WHERE titolo_id = p_madre_id AND tipo_premio = 'firma';

      v_is_first := false;
    ELSE
      INSERT INTO public.premi_garanzia_polizza (
        titolo_id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
        aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
        imposta_provinciale, ssn, codice_garanzia, tipo_premio,
        quietanza_personalizzata, accessori, provvigione_netto_pct, provvigione_accessori_pct
      )
      SELECT
        v_child.id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
        aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
        imposta_provinciale, ssn, codice_garanzia, 'quietanza',
        quietanza_personalizzata, accessori, provvigione_netto_pct, provvigione_accessori_pct
      FROM public.premi_garanzia_polizza
      WHERE titolo_id = p_madre_id AND tipo_premio = 'quietanza';
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clone_premi_rateo_su_quietanze(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.clone_premi_rateo_su_quietanze(uuid) IS
'Copia premi_garanzia dalla madre rateo alle quietanze: firma→Q1, quietanza→Q2+. Chiamare dopo insert premi su madre.';
