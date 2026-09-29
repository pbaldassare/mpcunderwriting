-- Appendice di modifica: titolo AM derivato cassabile (come PR/RG)

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS is_appendice_modifica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS appendice_modifica_polizza_madre_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

ALTER TABLE public.appendici_polizza
  ADD COLUMN IF NOT EXISTS titolo_modifica_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_appendice_modifica_madre
  ON public.titoli(appendice_modifica_polizza_madre_id) WHERE is_appendice_modifica = true;
CREATE INDEX IF NOT EXISTS idx_appendici_titolo_am ON public.appendici_polizza(titolo_modifica_id);

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

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crea_titolo_da_modifica(uuid) TO authenticated;

-- Skip generazione quietanza automatica anche per titoli AM
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

  IF COALESCE(NEW.is_regolazione, false)
     OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_appendice_modifica, false) THEN
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
      AND COALESCE(is_appendice_modifica, false) = false
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
    AND COALESCE(is_appendice_modifica, false) = false
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
    AND COALESCE(is_appendice_modifica, false) = false;

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
