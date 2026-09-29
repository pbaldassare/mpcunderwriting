-- Polizza rateo: primo periodo garanzia libero, rate successive per frazionamento fino a durata_a.
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS polizza_rateo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.titoli.polizza_rateo IS
  'Polizza con primo rateo a periodo libero: garanzia iniziale custom, quietanze successive per frazionamento fino a durata_a.';

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
    v_n_rate := 1;
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

    -- Prima quietanza: periodo rateo dalla madre
    v_gar_da := NEW.garanzia_da;
    v_gar_a := NEW.garanzia_a;
    v_competenza := COALESCE(NEW.data_competenza, NEW.garanzia_da);
    v_scadenza := COALESCE(NEW.data_scadenza, v_gar_a);
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
      false, true
    ) RETURNING id INTO v_new_id;

    v_prev_riga := v_new_riga;

    -- Rate successive: frazionamento standard dal giorno dopo garanzia_a fino a durata_a
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
        NEW.premio_lordo,
        NEW.numero_titolo, COALESCE(NEW.riga, 1),
        NEW.tipo_portafoglio,
        false, true
      ) RETURNING id INTO v_new_id;

      EXIT WHEN v_gar_a >= v_durata_fine;
      v_gar_da := v_gar_a;
      v_prev_riga := v_new_riga;
    END LOOP;

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
