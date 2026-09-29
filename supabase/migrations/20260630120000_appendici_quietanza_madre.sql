-- Appendici AM/PR/RG: quietanza sulla polizza madre (no polizza fantasma), sync incasso, view/filtri

-- ---------------------------------------------------------------------------
-- 1) Risolvi polizza madre da titolo madre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_risolvi_polizza_da_titolo_madre(p_madre_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_madre record;
  v_polizza_id uuid;
BEGIN
  IF p_madre_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_madre FROM public.titoli WHERE id = p_madre_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_madre.polizza_id IS NOT NULL THEN
    RETURN v_madre.polizza_id;
  END IF;

  SELECT id INTO v_polizza_id
  FROM public.polizze
  WHERE titolo_madre_id = p_madre_id
  LIMIT 1;
  IF v_polizza_id IS NOT NULL THEN RETURN v_polizza_id; END IF;

  SELECT id INTO v_polizza_id
  FROM public.polizze
  WHERE numero_polizza = split_part(v_madre.numero_titolo, '/', 1)
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_polizza_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_risolvi_polizza_da_titolo_madre(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_risolvi_polizza_da_titolo_madre(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Collega titolo appendice → quietanza sulla polizza madre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_collega_quietanza_appendice(p_titolo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_t record;
  v_madre_id uuid;
  v_polizza_id uuid;
  v_polizza_ref uuid;
  v_madre_numero text;
  v_numero_rata int;
  v_rate_totali int;
  v_appendice_lbl text;
  v_q_id uuid;
  v_old_polizza_id uuid;
BEGIN
  SELECT * INTO v_t FROM public.titoli WHERE id = p_titolo_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF NOT (
    COALESCE(v_t.is_appendice_modifica, false)
    OR COALESCE(v_t.is_proroga, false)
    OR COALESCE(v_t.is_regolazione, false)
  ) THEN
    RETURN NULL;
  END IF;

  -- Quietanza già collegata: correggi polizza se fantasma
  SELECT id, polizza_id INTO v_q_id, v_old_polizza_id
  FROM public.quietanze
  WHERE titolo_id = p_titolo_id
  LIMIT 1;

  IF COALESCE(v_t.is_regolazione, false) AND v_t.regolazione_quietanza_id IS NOT NULL THEN
    SELECT q.polizza_id INTO v_polizza_ref
    FROM public.quietanze q
    WHERE q.titolo_id = v_t.regolazione_quietanza_id
    LIMIT 1;
    SELECT tm.id INTO v_madre_id
    FROM public.titoli tq
    JOIN public.titoli tm
      ON tm.numero_titolo = split_part(tq.numero_titolo, '/', 1)
     AND tm.sostituisce_polizza IS NULL
    WHERE tq.id = v_t.regolazione_quietanza_id
    LIMIT 1;
  ELSIF COALESCE(v_t.is_proroga, false) THEN
    v_madre_id := v_t.proroga_polizza_madre_id;
  ELSIF COALESCE(v_t.is_appendice_modifica, false) THEN
    v_madre_id := v_t.appendice_modifica_polizza_madre_id;
  END IF;

  v_polizza_id := COALESCE(v_polizza_ref, public.fn_risolvi_polizza_da_titolo_madre(v_madre_id));
  IF v_polizza_id IS NULL THEN RETURN v_q_id; END IF;

  SELECT split_part(numero_titolo, '/', 1) INTO v_madre_numero
  FROM public.titoli WHERE id = v_madre_id;

  v_appendice_lbl := CASE
    WHEN COALESCE(v_t.is_regolazione, false) THEN 'RG'
    WHEN COALESCE(v_t.is_proroga, false) THEN 'PR'
    WHEN COALESCE(v_t.is_appendice_modifica, false) THEN 'AM'
    ELSE 'AP'
  END;

  IF v_q_id IS NOT NULL THEN
    IF v_old_polizza_id IS DISTINCT FROM v_polizza_id THEN
      SELECT COALESCE(MAX(numero_rata), 0) + 1 INTO v_numero_rata
      FROM public.quietanze WHERE polizza_id = v_polizza_id;

      UPDATE public.quietanze SET
        polizza_id = v_polizza_id,
        numero_rata = v_numero_rata,
        numero_polizza_snapshot = COALESCE(v_madre_numero, numero_polizza_snapshot),
        appendice = v_appendice_lbl,
        garanzia_da = COALESCE(v_t.garanzia_da, garanzia_da),
        garanzia_a = COALESCE(v_t.garanzia_a, garanzia_a),
        data_competenza = COALESCE(v_t.data_competenza, data_competenza),
        data_scadenza = COALESCE(v_t.data_scadenza, data_scadenza),
        premio_lordo = COALESCE(v_t.premio_lordo, premio_lordo),
        premio_netto = COALESCE(v_t.premio_netto, premio_netto),
        tasse = COALESCE(v_t.tasse, tasse),
        addizionali = COALESCE(v_t.addizionali, addizionali),
        ssn = COALESCE(v_t.ssn_firma, ssn),
        provvigioni_firma = COALESCE(v_t.provvigioni_firma, provvigioni_firma),
        provvigioni_quietanza = COALESCE(v_t.provvigioni_quietanza, v_t.provvigioni_firma, provvigioni_quietanza),
        updated_at = now()
      WHERE id = v_q_id;

      SELECT MAX(numero_rata) INTO v_rate_totali FROM public.quietanze WHERE polizza_id = v_polizza_id;
      UPDATE public.quietanze SET numero_rate_totali = v_rate_totali WHERE polizza_id = v_polizza_id;
    END IF;

    UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = p_titolo_id;
    RETURN v_q_id;
  END IF;

  SELECT COALESCE(MAX(numero_rata), 0) + 1 INTO v_numero_rata
  FROM public.quietanze WHERE polizza_id = v_polizza_id;

  INSERT INTO public.quietanze (
    polizza_id, numero_rata, numero_rate_totali,
    garanzia_da, garanzia_a, data_competenza, data_scadenza,
    mora_giorni, limite_mora,
    premio_lordo, premio_netto, tasse, addizionali, ssn,
    provvigioni_firma, provvigioni_quietanza,
    stato, appendice, numero_polizza_snapshot, titolo_id
  ) VALUES (
    v_polizza_id, v_numero_rata, v_numero_rata,
    v_t.garanzia_da, v_t.garanzia_a, v_t.data_competenza, v_t.data_scadenza,
    v_t.mora_giorni, v_t.limite_mora,
    COALESCE(v_t.premio_lordo, 0), COALESCE(v_t.premio_netto, 0),
    COALESCE(v_t.tasse, 0), COALESCE(v_t.addizionali, 0), COALESCE(v_t.ssn_firma, 0),
    COALESCE(v_t.provvigioni_firma, 0), COALESCE(v_t.provvigioni_quietanza, v_t.provvigioni_firma, 0),
    CASE v_t.stato
      WHEN 'incassato' THEN 'incassato'::public.quietanza_stato
      WHEN 'sospeso' THEN 'sospesa'::public.quietanza_stato
      WHEN 'annullato' THEN 'annullata'::public.quietanza_stato
      ELSE 'da_incassare'::public.quietanza_stato
    END,
    v_appendice_lbl,
    v_madre_numero,
    p_titolo_id
  ) RETURNING id INTO v_q_id;

  UPDATE public.quietanze SET numero_rate_totali = v_numero_rata WHERE polizza_id = v_polizza_id;

  UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = p_titolo_id;

  RETURN v_q_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_collega_quietanza_appendice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_collega_quietanza_appendice(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Skip polizza fantasma su insert titoli appendice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_titolo_after_insert_crea_polizza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_polizza_id uuid;
  v_numero_rata integer;
BEGIN
  IF NEW.polizza_id IS NOT NULL THEN RETURN NEW; END IF;
  IF current_setting('app.skip_titolo_to_polizza', true) = 'on' THEN RETURN NEW; END IF;
  IF current_setting('app.skip_legacy_sync', true) = 'on' THEN RETURN NEW; END IF;

  -- Titoli appendice: quietanza creata da fn_collega_quietanza_appendice (RPC)
  IF COALESCE(NEW.is_appendice_modifica, false)
     OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_regolazione, false) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.skip_legacy_sync', 'on', true);

  IF NEW.sostituisce_polizza IS NULL THEN
    PERFORM set_config('app.skip_genera_quietanze', 'on', true);

    INSERT INTO public.polizze (
      numero_polizza, cliente_anagrafica_id, ufficio_id,
      compagnia_id, ramo_id, prodotto_nome, descrizione_polizza,
      frazionamento, tipo_portafoglio, tipo_mandatario, risk_type,
      durata_da, durata_a, anni_durata, tacito_rinnovo,
      premio_annuo_lordo, premio_annuo_netto, tasse_annue, addizionali_annue,
      provvigioni_annue_firma, provvigioni_annue_quietanza,
      targa_telaio, cig_rif, vincolo,
      stato, titolo_madre_id, created_at
    ) VALUES (
      NEW.numero_titolo, NEW.cliente_anagrafica_id, NEW.ufficio_id,
      NEW.compagnia_id, NEW.ramo_id, NEW.prodotto_nome, NEW.descrizione_polizza,
      NEW.periodicita, NEW.tipo_portafoglio, NEW.tipo_mandatario, NEW.risk_type,
      NEW.durata_da, NEW.durata_a, NEW.anni_durata, coalesce(NEW.tacito_rinnovo, false),
      coalesce(NEW.premio_lordo, 0), coalesce(NEW.premio_netto, 0), coalesce(NEW.tasse, 0), coalesce(NEW.addizionali, 0),
      coalesce(NEW.provvigioni_firma, 0), coalesce(NEW.provvigioni_quietanza, 0),
      NEW.targa_telaio, NEW.cig_rif, NEW.vincolo,
      CASE NEW.stato WHEN 'sospeso' THEN 'sospesa'::polizza_stato
                     WHEN 'annullato' THEN 'annullata'::polizza_stato
                     ELSE 'attiva'::polizza_stato END,
      NEW.id, coalesce(NEW.created_at, now())
    ) RETURNING id INTO v_polizza_id;

    INSERT INTO public.quietanze (
      polizza_id, numero_rata, numero_rate_totali,
      garanzia_da, garanzia_a, data_competenza, data_scadenza,
      mora_giorni, limite_mora,
      premio_lordo, premio_netto, tasse, addizionali,
      provvigioni_firma, provvigioni_quietanza,
      stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
      tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
      titolo_id, created_at
    ) VALUES (
      v_polizza_id, 1, 1,
      NEW.garanzia_da, NEW.garanzia_a, NEW.data_competenza, NEW.data_scadenza,
      NEW.mora_giorni, NEW.limite_mora,
      coalesce(NEW.premio_lordo, 0), coalesce(NEW.premio_netto, 0), coalesce(NEW.tasse, 0), coalesce(NEW.addizionali, 0),
      coalesce(NEW.provvigioni_firma, 0), coalesce(NEW.provvigioni_quietanza, 0),
      CASE WHEN NEW.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
           WHEN NEW.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
           WHEN NEW.stato = 'annullato' THEN 'annullata'::quietanza_stato
           ELSE 'da_incassare'::quietanza_stato END,
      NEW.data_messa_cassa, NEW.data_pagamento, NEW.data_incasso, NEW.importo_incassato,
      NEW.tipo_incasso, NEW.conto_incasso, NEW.appendice, NEW.numero_titolo,
      NEW.id, coalesce(NEW.created_at, now())
    );

    PERFORM set_config('app.skip_genera_quietanze', 'off', true);
    UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = NEW.id;
  ELSE
    SELECT id INTO v_polizza_id
    FROM public.polizze
    WHERE numero_polizza = NEW.numero_titolo
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_polizza_id IS NOT NULL THEN
      SELECT coalesce(MAX(numero_rata), 0) + 1 INTO v_numero_rata
      FROM public.quietanze WHERE polizza_id = v_polizza_id;

      INSERT INTO public.quietanze (
        polizza_id, numero_rata, numero_rate_totali,
        garanzia_da, garanzia_a, data_competenza, data_scadenza,
        mora_giorni, limite_mora,
        premio_lordo, premio_netto, tasse, addizionali,
        provvigioni_firma, provvigioni_quietanza,
        stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
        tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
        titolo_id, created_at
      ) VALUES (
        v_polizza_id, v_numero_rata, v_numero_rata,
        NEW.garanzia_da, NEW.garanzia_a, NEW.data_competenza, NEW.data_scadenza,
        NEW.mora_giorni, NEW.limite_mora,
        coalesce(NEW.premio_lordo, 0), coalesce(NEW.premio_netto, 0), coalesce(NEW.tasse, 0), coalesce(NEW.addizionali, 0),
        coalesce(NEW.provvigioni_firma, 0), coalesce(NEW.provvigioni_quietanza, 0),
        CASE WHEN NEW.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
             WHEN NEW.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
             WHEN NEW.stato = 'annullato' THEN 'annullata'::quietanza_stato
             ELSE 'da_incassare'::quietanza_stato END,
        NEW.data_messa_cassa, NEW.data_pagamento, NEW.data_incasso, NEW.importo_incassato,
        NEW.tipo_incasso, NEW.conto_incasso, NEW.appendice, NEW.numero_titolo,
        NEW.id, coalesce(NEW.created_at, now())
      );

      UPDATE public.quietanze SET numero_rate_totali = v_numero_rata WHERE polizza_id = v_polizza_id;
      UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = NEW.id;
    END IF;
  END IF;

  PERFORM set_config('app.skip_legacy_sync', 'off', true);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Sync incasso titolo → quietanza collegata
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_titoli_sync_quietanza_da_titolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    NEW.stato IS DISTINCT FROM OLD.stato
    OR NEW.data_messa_cassa IS DISTINCT FROM OLD.data_messa_cassa
    OR NEW.data_incasso IS DISTINCT FROM OLD.data_incasso
    OR NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento
    OR NEW.importo_incassato IS DISTINCT FROM OLD.importo_incassato
    OR NEW.tipo_pagamento IS DISTINCT FROM OLD.tipo_pagamento
    OR NEW.banca_pagamento IS DISTINCT FROM OLD.banca_pagamento
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.quietanze q SET
    stato = CASE NEW.stato
      WHEN 'incassato' THEN 'incassato'::public.quietanza_stato
      WHEN 'sospeso' THEN 'sospesa'::public.quietanza_stato
      WHEN 'annullato' THEN 'annullata'::public.quietanza_stato
      ELSE 'da_incassare'::public.quietanza_stato
    END,
    data_messa_cassa = NEW.data_messa_cassa,
    data_incasso = NEW.data_incasso,
    data_pagamento = NEW.data_pagamento,
    importo_incassato = NEW.importo_incassato,
    tipo_incasso = NEW.tipo_pagamento,
    conto_incasso = NEW.banca_pagamento,
    updated_at = now()
  WHERE q.titolo_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_sync_quietanza_da_titolo ON public.titoli;
CREATE TRIGGER trg_titoli_sync_quietanza_da_titolo
  AFTER UPDATE OF stato, data_messa_cassa, data_incasso, data_pagamento,
    importo_incassato, tipo_pagamento, banca_pagamento
  ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_titoli_sync_quietanza_da_titolo();

-- ---------------------------------------------------------------------------
-- 5) Patch RPC crea_titolo_* → collega quietanza madre
-- ---------------------------------------------------------------------------
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

-- crea_titolo_da_proroga: aggiunge fn_collega
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
    PERFORM public.fn_collega_quietanza_appendice(v_app.titolo_proroga_id);
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

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);
  RETURN v_new_id;
END;
$$;

-- crea_titolo_da_regolazione: aggiunge fn_collega
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
    PERFORM public.fn_collega_quietanza_appendice(v_app.titolo_regolazione_id);
    RETURN v_app.titolo_regolazione_id;
  END IF;
  IF v_app.quietanza_id IS NULL THEN RAISE EXCEPTION 'quietanza_id mancante'; END IF;

  SELECT * INTO v_q FROM public.titoli WHERE id = v_app.quietanza_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quietanza % non trovata', v_app.quietanza_id; END IF;

  SELECT * INTO v_madre FROM public.titoli
    WHERE numero_titolo = v_q.numero_titolo AND sostituisce_polizza IS NULL
    LIMIT 1;
  IF NOT FOUND THEN v_madre := v_q; END IF;

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.titoli WHERE numero_titolo LIKE (v_madre.numero_titolo || '/RG%');
  v_numero_rg := split_part(v_madre.numero_titolo, '/', 1) || '/RG' || v_seq::text;

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
    COALESCE(v_app.premio_lordo, COALESCE(v_app.premio_netto, 0) + COALESCE(v_app.tasse, 0)),
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

  PERFORM public.fn_collega_quietanza_appendice(v_new_id);
  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) genera_quietanza_su_messa_cassa: skip AM/PR/RG/onere
-- ---------------------------------------------------------------------------
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
     OR COALESCE(NEW.is_appendice_modifica, false)
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
      AND COALESCE(is_appendice_modifica, false) = false
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

-- ---------------------------------------------------------------------------
-- 7) View portafoglio: espone appendici + numero titolo derivato
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_portafoglio_quietanze CASCADE;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  q.titolo_id                                         AS id,
  q.id                                                AS quietanza_id,
  p.id                                                AS polizza_id,
  q.titolo_id                                         AS titolo_legacy_id,
  COALESCE(p.numero_polizza, q.numero_polizza_snapshot, t.numero_titolo) AS numero_titolo,
  t.numero_titolo                                     AS titolo_derivato_numero,
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
  t.is_appendice_modifica,
  t.regolazione_quietanza_id,
  t.proroga_polizza_madre_id,
  t.appendice_modifica_polizza_madre_id,
  q.appendice                                         AS appendice_tipo,
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

-- ---------------------------------------------------------------------------
-- 8) Backfill appendici esistenti + pulizia polizze fantasma
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_phantom record;
BEGIN
  FOR r IN
    SELECT id FROM public.titoli
    WHERE COALESCE(is_appendice_modifica, false)
       OR COALESCE(is_proroga, false)
       OR COALESCE(is_regolazione, false)
  LOOP
    PERFORM public.fn_collega_quietanza_appendice(r.id);
  END LOOP;

  FOR v_phantom IN
    SELECT p.id AS polizza_id
    FROM public.polizze p
    WHERE p.numero_polizza ~ '/(AM|PR|RG)[0-9]+$'
      AND NOT EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.polizza_id = p.id
          AND NOT (
            COALESCE(t.is_appendice_modifica, false)
            OR COALESCE(t.is_proroga, false)
            OR COALESCE(t.is_regolazione, false)
          )
      )
  LOOP
    DELETE FROM public.quietanze WHERE polizza_id = v_phantom.polizza_id;
    DELETE FROM public.polizze WHERE id = v_phantom.polizza_id;
  END LOOP;
END;
$$;
