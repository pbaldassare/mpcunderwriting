
-- 0) Restringi l'indice unico anti-duplicato-rinnovo alle sole madri.
DROP INDEX IF EXISTS public.titoli_no_duplicati_rinnovo;
CREATE UNIQUE INDEX titoli_no_duplicati_rinnovo
  ON public.titoli (numero_titolo, compagnia_id, data_scadenza)
  WHERE numero_titolo IS NOT NULL
    AND data_scadenza IS NOT NULL
    AND sostituisce_polizza IS NULL;

-- 1) Trigger: genera rate 1..N (rata 1 = stesse date della madre)
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
BEGIN
  IF NEW.sostituisce_polizza IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_regolazione, false) THEN RETURN NEW; END IF;
  IF NEW.numero_titolo IS NULL THEN RETURN NEW; END IF;
  IF NEW.garanzia_da IS NULL OR NEW.garanzia_a IS NULL THEN RETURN NEW; END IF;

  v_frazionamento := COALESCE(NEW.frazionamento, '');
  v_months_period := CASE LOWER(v_frazionamento)
    WHEN 'mensile' THEN 1 WHEN 'trimestrale' THEN 3 WHEN 'quadrimestrale' THEN 4
    WHEN 'semestrale' THEN 6 WHEN 'annuale' THEN 12 WHEN 'poliennale' THEN 0
    ELSE 0 END;
  IF v_months_period = 0 THEN RETURN NEW; END IF;

  v_anni := GREATEST(1, COALESCE(NEW.anni_durata, 1));
  v_n_rate := (12 / v_months_period) * v_anni;
  IF v_n_rate < 1 THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
     WHERE sostituisce_polizza = NEW.numero_titolo
       AND COALESCE(is_regolazione, false) = false
  ) THEN RETURN NEW; END IF;

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
      NEW.tipo_portafoglio
    ) RETURNING id INTO v_new_id;

    v_prev_riga := v_new_riga;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 2) Backfill
DO $$
DECLARE
  m record; v_months int; v_new_riga int; v_new_id uuid;
BEGIN
  FOR m IN
    SELECT t.*
    FROM public.titoli t
    WHERE t.sostituisce_polizza IS NULL
      AND COALESCE(t.is_regolazione, false) = false
      AND t.numero_titolo IS NOT NULL
      AND t.garanzia_da IS NOT NULL
      AND t.garanzia_a IS NOT NULL
      AND LOWER(COALESCE(t.frazionamento,'')) IN ('mensile','trimestrale','quadrimestrale','semestrale','annuale')
      AND NOT EXISTS (
        SELECT 1 FROM public.titoli q
        WHERE q.sostituisce_polizza = t.numero_titolo
          AND COALESCE(q.is_regolazione, false) = false
      )
  LOOP
    v_months := CASE LOWER(m.frazionamento)
      WHEN 'mensile' THEN 1 WHEN 'trimestrale' THEN 3
      WHEN 'quadrimestrale' THEN 4 WHEN 'semestrale' THEN 6
      WHEN 'annuale' THEN 12 ELSE 0 END;
    IF v_months = 0 THEN CONTINUE; END IF;

    v_new_riga := COALESCE(m.riga, 1) + 1;

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
      data_messa_cassa, data_incasso
    ) VALUES (
      m.numero_titolo, v_new_riga,
      CASE WHEN m.data_messa_cassa IS NOT NULL OR m.stato = 'incassato' THEN 'incassato' ELSE 'attivo' END,
      m.cliente_id, m.cliente_anagrafica_id,
      m.prodotto_id, m.prodotto_nome,
      m.ufficio_id, m.produttore_id, m.produttore_nome,
      m.compagnia_id, m.compagnia_rapporto_id, m.codice_rapporto,
      m.ramo_id, m.specialist,
      m.commerciale_id, m.anagrafica_commerciale_id,
      m.percentuale_commerciale, m.percentuale_riparto, m.tipo_mandatario,
      m.ae_anagrafica_id, m.ae_nome,
      m.anni_durata, m.rate, m.periodicita, m.frazionamento,
      m.tipo_rinnovo, m.tacito_rinnovo, m.disdetta_mesi,
      m.descrizione_polizza, m.targa_telaio, m.risk_type,
      m.valuta, m.cambio, m.indicizzata, m.no_calcolo_tasse,
      m.durata_da, m.durata_a, m.data_scadenza, m.data_competenza,
      m.garanzia_da, m.garanzia_a,
      m.premio_netto, m.tasse, m.ssn_firma, m.addizionali, m.provvigioni_firma,
      COALESCE(m.premio_netto_quietanza, m.premio_netto),
      COALESCE(m.tasse_quietanza, m.tasse),
      COALESCE(m.ssn_quietanza, m.ssn_firma),
      COALESCE(m.addizionali_quietanza, m.addizionali),
      COALESCE(m.provvigioni_quietanza, m.provvigioni_firma),
      m.premio_lordo,
      m.numero_titolo, COALESCE(m.riga, 1),
      m.tipo_portafoglio,
      m.data_messa_cassa, m.data_incasso
    ) RETURNING id INTO v_new_id;

    IF m.data_messa_cassa IS NOT NULL OR m.stato = 'incassato' THEN
      UPDATE public.titoli
         SET data_messa_cassa = NULL,
             data_incasso = NULL,
             stato = CASE WHEN m.garanzia_a < CURRENT_DATE THEN 'scaduto' ELSE 'attivo' END
       WHERE id = m.id;
    END IF;
  END LOOP;
END $$;
