-- Appendice di proroga: titolo PR derivato cassabile + estensione polizza madre su incasso

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS is_proroga boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proroga_polizza_madre_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

ALTER TABLE public.appendici_polizza
  ADD COLUMN IF NOT EXISTS titolo_proroga_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_proroga_madre ON public.titoli(proroga_polizza_madre_id) WHERE is_proroga = true;
CREATE INDEX IF NOT EXISTS idx_appendici_titolo_pr ON public.appendici_polizza(titolo_proroga_id);

CREATE TABLE IF NOT EXISTS public.titoli_proroghe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_madre_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  titolo_proroga_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  data_proroga date NOT NULL,
  periodo_da date,
  periodo_a date,
  premio_lordo numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_titoli_proroghe_madre ON public.titoli_proroghe(titolo_madre_id);
ALTER TABLE public.titoli_proroghe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff select titoli_proroghe" ON public.titoli_proroghe;
CREATE POLICY "Staff select titoli_proroghe" ON public.titoli_proroghe FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff insert titoli_proroghe" ON public.titoli_proroghe;
CREATE POLICY "Staff insert titoli_proroghe" ON public.titoli_proroghe FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- RPC: crea titolo PR da appendice proroga
CREATE OR REPLACE FUNCTION public.crea_titolo_da_proroga(p_appendice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_madre record;
  v_new_id uuid;
  v_numero_pr text;
  v_seq int;
  v_perc numeric;
  v_prov numeric;
  v_base_numero text;
BEGIN
  SELECT * INTO v_app FROM public.appendici_polizza WHERE id = p_appendice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appendice % non trovata', p_appendice_id; END IF;
  IF v_app.tipo <> 'proroga' THEN RAISE EXCEPTION 'Appendice non è di tipo proroga'; END IF;
  IF v_app.titolo_proroga_id IS NOT NULL THEN
    RETURN v_app.titolo_proroga_id;
  END IF;

  SELECT * INTO v_madre FROM public.titoli WHERE id = v_app.titolo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Polizza madre non trovata'; END IF;

  v_base_numero := split_part(v_madre.numero_titolo, '/', 1);

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_base_numero || '/PR%');
  v_numero_pr := v_base_numero || '/PR' || v_seq::text;

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
    numero_titolo, riga, stato, is_proroga, proroga_polizza_madre_id,
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
    v_numero_pr, 1, 'attivo', true, v_madre.id,
    v_madre.cliente_id, v_madre.cliente_anagrafica_id,
    v_madre.prodotto_id, v_madre.prodotto_nome,
    v_madre.ufficio_id, v_madre.produttore_id, v_madre.produttore_nome,
    v_madre.compagnia_id, v_madre.compagnia_rapporto_id, v_madre.codice_rapporto,
    v_madre.ramo_id, v_madre.specialist,
    v_madre.commerciale_id, v_madre.anagrafica_commerciale_id,
    v_madre.percentuale_commerciale, v_madre.percentuale_riparto, v_madre.tipo_mandatario,
    v_madre.ae_anagrafica_id, v_madre.ae_nome,
    'Proroga - ' || COALESCE(v_app.oggetto, v_madre.descrizione_polizza, ''),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.data_scadenza),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.premio_netto, 0),
    COALESCE(v_app.tasse, 0),
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto, 0) + COALESCE(v_app.tasse, 0)),
    v_prov, v_perc,
    v_madre.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  UPDATE public.appendici_polizza
     SET titolo_proroga_id = v_new_id,
         provvigioni = v_prov,
         percentuale_provvigione = v_perc
   WHERE id = p_appendice_id;

  INSERT INTO public.titoli_proroghe (
    titolo_madre_id, titolo_proroga_id,
    data_proroga, periodo_da, periodo_a,
    premio_lordo, note, created_by
  ) VALUES (
    v_madre.id, v_new_id,
    COALESCE(v_app.data_appendice, CURRENT_DATE),
    COALESCE(v_app.data_effetto, v_madre.garanzia_a),
    COALESCE(v_app.data_appendice, v_madre.garanzia_a),
    COALESCE(v_app.premio_lordo, 0),
    v_app.note, v_app.created_by
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crea_titolo_da_proroga(uuid) TO authenticated;

-- Su incasso proroga: estendi date polizza madre (+ polizze collegate)
CREATE OR REPLACE FUNCTION public.estendi_polizza_su_incasso_proroga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_madre_id uuid;
  v_nuova_scadenza date;
BEGIN
  IF NEW.stato <> 'incassato' OR OLD.stato = 'incassato' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(NEW.is_proroga, false) THEN
    RETURN NEW;
  END IF;

  v_madre_id := NEW.proroga_polizza_madre_id;
  v_nuova_scadenza := COALESCE(NEW.garanzia_a, NEW.data_scadenza);
  IF v_madre_id IS NULL OR v_nuova_scadenza IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.titoli
     SET garanzia_a = v_nuova_scadenza,
         data_scadenza = v_nuova_scadenza,
         durata_a = v_nuova_scadenza,
         updated_at = now()
   WHERE id = v_madre_id
     AND (garanzia_a IS NULL OR garanzia_a < v_nuova_scadenza);

  UPDATE public.polizze
     SET durata_a = v_nuova_scadenza,
         updated_at = now()
   WHERE titolo_madre_id = v_madre_id
     AND (durata_a IS NULL OR durata_a < v_nuova_scadenza);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estendi_polizza_su_incasso_proroga ON public.titoli;
CREATE TRIGGER trg_estendi_polizza_su_incasso_proroga
  AFTER UPDATE OF stato ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.estendi_polizza_su_incasso_proroga();

-- Patch genera_quietanza: skip anche proroghe (one-shot)
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

  IF COALESCE(NEW.is_regolazione, false) OR COALESCE(NEW.is_proroga, false) THEN
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
    AND COALESCE(is_proroga, false) = false;

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

-- View portafoglio: espone is_proroga
DROP VIEW IF EXISTS public.v_portafoglio_quietanze CASCADE;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  q.titolo_id                                         AS id,
  q.id                                                AS quietanza_id,
  p.id                                                AS polizza_id,
  q.titolo_id                                         AS titolo_legacy_id,
  COALESCE(p.numero_polizza, q.numero_polizza_snapshot, t.numero_titolo) AS numero_titolo,
  q.numero_polizza_snapshot,
  p.cig_rif,
  p.appendice_corrente,
  p.cliente_anagrafica_id,
  COALESCE(
    cli.ragione_sociale,
    NULLIF(TRIM(COALESCE(cli.cognome, '') || ' ' || COALESCE(cli.nome, '')), ''),
    '—'
  )                                                   AS cliente_nome_display,
  cli.codice_cliente                                  AS cliente_codice,
  p.compagnia_id,
  comp.nome                                           AS compagnia_nome,
  p.ramo_id,
  r.descrizione                                       AS ramo_nome,
  r.codice                                            AS ramo_codice,
  COALESCE(t.stato::text, p.stato::text)              AS stato,
  q.stato                                             AS stato_quietanza,
  p.stato                                             AS stato_polizza,
  q.garanzia_da,
  q.garanzia_a,
  q.data_competenza,
  q.data_scadenza,
  q.premio_lordo,
  q.premio_netto,
  q.tasse,
  q.addizionali,
  q.ssn,
  q.provvigioni_firma,
  q.provvigioni_quietanza,
  q.importo_incassato,
  t.rate,
  p.frazionamento,
  p.targa_telaio,
  t.ae_nome,
  t.specialist,
  t.produttore_nome,
  p.descrizione_polizza,
  p.tipo_portafoglio,
  p.tacito_rinnovo,
  p.regolazione,
  p.durata_da,
  p.durata_a,
  q.data_messa_cassa,
  q.data_pagamento,
  q.data_incasso,
  COALESCE(t.data_copertura, q.data_copertura)        AS data_copertura,
  t.data_decorrenza_rinnovo,
  t.conferimento_gestito,
  t.fondi_ricevuti,
  p.data_sospensione,
  p.data_riattivazione,
  t.limite_riattivazione,
  t.sostituisce_polizza,
  t.is_regolazione,
  t.is_proroga,
  t.regolazione_quietanza_id,
  t.proroga_polizza_madre_id,
  q.numero_rata,
  q.numero_rate_totali,
  p.ufficio_id,
  p.account_executive_anagrafica_id                   AS ae_anagrafica_id,
  p.anagrafica_commerciale_id,
  p.produttore_anagrafica_id                          AS produttore_id
FROM quietanze q
JOIN polizze   p    ON p.id = q.polizza_id
LEFT JOIN titoli    t   ON t.id  = q.titolo_id
LEFT JOIN clienti   cli ON cli.id = p.cliente_anagrafica_id
LEFT JOIN compagnie comp ON comp.id = p.compagnia_id
LEFT JOIN rami      r   ON r.id  = p.ramo_id
WHERE q.titolo_id IS NOT NULL;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT SELECT ON public.v_portafoglio_quietanze TO anon;
GRANT SELECT ON public.v_portafoglio_quietanze TO service_role;
