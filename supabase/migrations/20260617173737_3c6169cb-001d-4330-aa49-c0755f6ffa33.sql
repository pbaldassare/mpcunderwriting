
-- ============================================================
-- Regolazione come Appendice + Titolo RG dedicato
-- ============================================================

-- 1) Estensione appendici_polizza
ALTER TABLE public.appendici_polizza
  ADD COLUMN IF NOT EXISTS quietanza_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titolo_regolazione_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS premio_netto numeric(14,2),
  ADD COLUMN IF NOT EXISTS tasse numeric(14,2),
  ADD COLUMN IF NOT EXISTS premio_lordo numeric(14,2),
  ADD COLUMN IF NOT EXISTS provvigioni numeric(14,2),
  ADD COLUMN IF NOT EXISTS percentuale_provvigione numeric(7,4);

-- 2) Flag e link sul titolo RG generato
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS is_regolazione boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regolazione_quietanza_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_regolazione_quietanza ON public.titoli(regolazione_quietanza_id) WHERE is_regolazione = true;
CREATE INDEX IF NOT EXISTS idx_appendici_quietanza ON public.appendici_polizza(quietanza_id);
CREATE INDEX IF NOT EXISTS idx_appendici_titolo_rg ON public.appendici_polizza(titolo_regolazione_id);

-- 3) Patch trigger: la regolazione non deve generare la rata successiva
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

  -- Skip: la regolazione è one-shot, non genera rata successiva
  IF COALESCE(NEW.is_regolazione, false) THEN
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

-- 4) RPC per generare il titolo RG da un'appendice di tipo 'regolazione'
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
    RETURN v_app.titolo_regolazione_id;
  END IF;
  IF v_app.quietanza_id IS NULL THEN RAISE EXCEPTION 'quietanza_id mancante'; END IF;

  SELECT * INTO v_q FROM public.titoli WHERE id = v_app.quietanza_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quietanza % non trovata', v_app.quietanza_id; END IF;

  -- Madre = titolo della catena senza sostituisce_polizza
  SELECT * INTO v_madre FROM public.titoli
    WHERE numero_titolo = v_q.numero_titolo AND sostituisce_polizza IS NULL
    LIMIT 1;
  IF NOT FOUND THEN v_madre := v_q; END IF;

  -- Numero progressivo regolazione per la stessa polizza madre
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_madre.numero_titolo || '/RG%');
  v_numero_rg := v_madre.numero_titolo || '/RG' || v_seq::text;

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
    provvigioni_firma, percentuale_provvigione,
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
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto,0) + COALESCE(v_app.tasse,0)),
    v_prov, v_perc,
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

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crea_titolo_da_regolazione(uuid) TO authenticated;
