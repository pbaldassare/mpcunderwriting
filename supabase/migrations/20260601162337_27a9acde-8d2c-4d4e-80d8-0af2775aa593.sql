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

  IF NEW.numero_titolo IS NULL THEN
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
  WHERE numero_titolo = NEW.numero_titolo;

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
    ROUND(
      (COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto, 0)
       + COALESCE(NEW.tasse_quietanza, NEW.tasse, 0)
       + COALESCE(NEW.ssn_quietanza, NEW.ssn_firma, 0)
       + COALESCE(NEW.addizionali_quietanza, NEW.addizionali, 0))::numeric
    , 2),
    NEW.numero_titolo, NEW.riga,
    NEW.tipo_portafoglio
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.premi_garanzia_polizza (
    titolo_id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
    aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
    imposta_provinciale, ssn, codice_garanzia, tipo_premio,
    quietanza_personalizzata
  )
  SELECT
    v_new_id, garanzia, capitale, tasso, firma, rata, annuo, ordine,
    aliquota_tasse_pct, lordo_calcolato, is_rca_principale,
    imposta_provinciale, ssn, codice_garanzia, tipo_premio,
    quietanza_personalizzata
  FROM public.premi_garanzia_polizza
  WHERE titolo_id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Backfill: ricalcola premio_lordo delle quietanze già generate (non ancora messe a cassa)
UPDATE public.titoli
SET premio_lordo = ROUND(
  (COALESCE(premio_netto,0) + COALESCE(tasse,0) + COALESCE(ssn_firma,0) + COALESCE(addizionali,0))::numeric
, 2)
WHERE sostituisce_polizza IS NOT NULL
  AND data_messa_cassa IS NULL
  AND stato <> 'stornato'
  AND ABS(COALESCE(premio_lordo,0) - (COALESCE(premio_netto,0)+COALESCE(tasse,0)+COALESCE(ssn_firma,0)+COALESCE(addizionali,0))) > 0.01;