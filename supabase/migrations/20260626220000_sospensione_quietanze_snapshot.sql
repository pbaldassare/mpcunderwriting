-- Sospensione / riattivazione: snapshot quietanze congelate + flag titoli oneri

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS quietanze_sospensione_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS is_oneri_sospensione boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_oneri_riattivazione boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.titoli.quietanze_sospensione_snapshot IS
  'Snapshot JSON delle quietanze congelate alla sospensione (date originali + in_corso).';

-- Patch genera_quietanza: skip titoli oneri sospensione/riattivazione (one-shot in Carico)
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

  IF COALESCE(NEW.is_regolazione, false) OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_oneri_sospensione, false) OR COALESCE(NEW.is_oneri_riattivazione, false) THEN
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

  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND COALESCE(polizza_rateo, false) = true
  ) AND EXISTS (
    SELECT 1 FROM public.titoli
    WHERE sostituisce_polizza = NEW.numero_titolo
      AND COALESCE(is_regolazione, false) = false
      AND COALESCE(is_proroga, false) = false
      AND COALESCE(is_oneri_sospensione, false) = false
      AND COALESCE(is_oneri_riattivazione, false) = false
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
    AND COALESCE(is_proroga, false) = false
    AND COALESCE(is_oneri_sospensione, false) = false
    AND COALESCE(is_oneri_riattivazione, false) = false
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
    AND COALESCE(is_regolazione, false) = false
    AND COALESCE(is_proroga, false) = false
    AND COALESCE(is_oneri_sospensione, false) = false
    AND COALESCE(is_oneri_riattivazione, false) = false;

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
