-- Bonifica legacy: polizze madri incassate direttamente (vecchio flusso) senza
-- quietanza rata-1 separata. Crea la rata 1 incassata, ripulisce la madre e
-- riallinea quietanze / movimenti / provvigioni.

CREATE OR REPLACE FUNCTION public.fn_backfill_madre_incassata_crea_rata1(p_madre_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  v_q1_id uuid;
  v_q1_riga int;
  v_qz1_id uuid;
  v_n_rate int;
BEGIN
  SELECT * INTO m
  FROM public.titoli
  WHERE id = p_madre_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Madre % non trovata', p_madre_id;
  END IF;

  IF m.sostituisce_polizza IS NOT NULL THEN
    RAISE EXCEPTION 'Titolo % non è una polizza madre', p_madre_id;
  END IF;

  IF COALESCE(m.is_regolazione, false)
     OR COALESCE(m.is_appendice_modifica, false)
     OR COALESCE(m.is_proroga, false) THEN
    RAISE EXCEPTION 'Titolo % non è una polizza madre standard', p_madre_id;
  END IF;

  IF m.numero_titolo IS NULL THEN
    RAISE EXCEPTION 'Madre % senza numero_titolo', p_madre_id;
  END IF;

  IF m.data_messa_cassa IS NULL AND m.stato IS DISTINCT FROM 'incassato' THEN
    RAISE EXCEPTION 'Madre % non risulta incassata', p_madre_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.titoli q
    WHERE q.sostituisce_polizza = m.numero_titolo
      AND q.garanzia_da = m.garanzia_da
      AND COALESCE(q.is_regolazione, false) = false
      AND COALESCE(q.is_appendice_modifica, false) = false
      AND COALESCE(q.is_proroga, false) = false
  ) THEN
    RAISE NOTICE 'Rata 1 già presente per polizza %', m.numero_titolo;
    RETURN NULL;
  END IF;

  PERFORM set_config('app.skip_legacy_sync', 'on', true);
  PERFORM set_config('app.skip_genera_quietanze', 'on', true);

  v_q1_riga := COALESCE(m.riga, 0) + 1;

  SELECT COUNT(*)::int + 1
    INTO v_n_rate
  FROM public.titoli q
  WHERE q.sostituisce_polizza = m.numero_titolo
    AND COALESCE(q.is_regolazione, false) = false
    AND COALESCE(q.is_appendice_modifica, false) = false
    AND COALESCE(q.is_proroga, false) = false;

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
    tipo_portafoglio, polizza_id,
    tipo_pagamento, tipo_incasso, conto_incasso,
    importo_incassato, data_messa_cassa, data_incasso, data_pagamento,
    data_copertura, fondi_ricevuti, conferimento_gestito,
    polizza_temporanea, polizza_rateo,
    pag_diretto_compagnia,
    mora_giorni, limite_mora, appendice
  ) VALUES (
    m.numero_titolo, v_q1_riga, 'incassato',
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
    COALESCE(m.premio_netto_quietanza, m.premio_netto),
    COALESCE(m.tasse_quietanza, m.tasse),
    COALESCE(m.ssn_quietanza, m.ssn_firma),
    COALESCE(m.addizionali_quietanza, m.addizionali),
    COALESCE(m.provvigioni_quietanza, m.provvigioni_firma),
    COALESCE(m.premio_netto_quietanza, m.premio_netto),
    COALESCE(m.tasse_quietanza, m.tasse),
    COALESCE(m.ssn_quietanza, m.ssn_firma),
    COALESCE(m.addizionali_quietanza, m.addizionali),
    COALESCE(m.provvigioni_quietanza, m.provvigioni_firma),
    m.premio_lordo,
    m.numero_titolo, COALESCE(m.riga, 0),
    m.tipo_portafoglio, m.polizza_id,
    m.tipo_pagamento, m.tipo_incasso, m.conto_incasso,
    m.importo_incassato, m.data_messa_cassa, m.data_incasso, m.data_pagamento,
    m.data_copertura, m.fondi_ricevuti, m.conferimento_gestito,
    COALESCE(m.polizza_temporanea, false), COALESCE(m.polizza_rateo, false),
    m.pag_diretto_compagnia,
    m.mora_giorni, m.limite_mora, m.appendice
  )
  RETURNING id INTO v_q1_id;

  -- Madre = solo contratto (shell), senza dati di incasso
  UPDATE public.titoli
  SET
    stato = CASE
      WHEN garanzia_a IS NOT NULL AND garanzia_a < CURRENT_DATE THEN 'scaduto'
      ELSE 'attivo'
    END,
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    data_copertura = NULL,
    conferimento_gestito = false
  WHERE id = m.id;

  -- Tabella quietanze (modello nuovo): rata 1 sulla quietanza creata
  UPDATE public.quietanze q
  SET
    titolo_id = v_q1_id,
    stato = 'incassato',
    data_messa_cassa = m.data_messa_cassa,
    data_pagamento = m.data_pagamento,
    data_incasso = m.data_incasso,
    importo_incassato = m.importo_incassato,
    tipo_incasso = m.tipo_incasso,
    conto_incasso = m.conto_incasso,
    numero_rate_totali = GREATEST(COALESCE(q.numero_rate_totali, 1), v_n_rate),
    updated_at = now()
  WHERE q.polizza_id = m.polizza_id
    AND q.numero_rata = 1
  RETURNING id INTO v_qz1_id;

  -- Rate successive: collega polizza_id e crea quietanze mancanti
  UPDATE public.titoli q
  SET polizza_id = m.polizza_id
  WHERE q.sostituisce_polizza = m.numero_titolo
    AND q.polizza_id IS NULL;

  INSERT INTO public.quietanze (
    polizza_id, numero_rata, numero_rate_totali,
    garanzia_da, garanzia_a, data_competenza, data_scadenza,
    mora_giorni, limite_mora,
    premio_lordo, premio_netto, tasse, addizionali,
    provvigioni_firma, provvigioni_quietanza,
    stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
    tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
    titolo_id
  )
  SELECT
    m.polizza_id,
    ROW_NUMBER() OVER (ORDER BY q.garanzia_da NULLS LAST, q.riga, q.created_at) + 1,
    v_n_rate,
    q.garanzia_da, q.garanzia_a, q.data_competenza, q.data_scadenza,
    q.mora_giorni, q.limite_mora,
    COALESCE(q.premio_lordo, 0), COALESCE(q.premio_netto, 0),
    COALESCE(q.tasse, 0), COALESCE(q.addizionali, 0),
    COALESCE(q.provvigioni_firma, 0), COALESCE(q.provvigioni_quietanza, 0),
    CASE
      WHEN q.data_messa_cassa IS NOT NULL OR q.stato = 'incassato' THEN 'incassato'::quietanza_stato
      WHEN q.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
      WHEN q.stato = 'annullato' THEN 'annullata'::quietanza_stato
      ELSE 'da_incassare'::quietanza_stato
    END,
    q.data_messa_cassa, q.data_pagamento, q.data_incasso, q.importo_incassato,
    q.tipo_incasso, q.conto_incasso, q.appendice, q.numero_titolo,
    q.id
  FROM public.titoli q
  WHERE q.sostituisce_polizza = m.numero_titolo
    AND COALESCE(q.is_regolazione, false) = false
    AND COALESCE(q.is_appendice_modifica, false) = false
    AND COALESCE(q.is_proroga, false) = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.quietanze existing
      WHERE existing.polizza_id = m.polizza_id
        AND existing.titolo_id = q.id
    )
  ON CONFLICT (polizza_id, numero_rata) DO UPDATE
  SET
    titolo_id = EXCLUDED.titolo_id,
    garanzia_da = EXCLUDED.garanzia_da,
    garanzia_a = EXCLUDED.garanzia_a,
    premio_lordo = EXCLUDED.premio_lordo,
    updated_at = now();

  -- Movimenti e provvigioni restano sulla rata incassata, non sulla madre
  UPDATE public.movimenti_polizza
  SET titolo_id = v_q1_id, riga = v_q1_riga
  WHERE titolo_id = m.id;

  UPDATE public.provvigioni_generate
  SET titolo_id = v_q1_id,
      quietanza_id = COALESCE(v_qz1_id, quietanza_id)
  WHERE titolo_id = m.id;

  PERFORM set_config('app.skip_legacy_sync', 'off', true);
  PERFORM set_config('app.skip_genera_quietanze', 'off', true);

  RETURN v_q1_id;
END;
$$;

COMMENT ON FUNCTION public.fn_backfill_madre_incassata_crea_rata1(uuid) IS
'Legacy: crea quietanza rata-1 incassata quando la polizza madre era stata messa a cassa direttamente.';

-- Applica a tutte le madri incassate senza rata-1 corrispondente
DO $$
DECLARE
  r RECORD;
  v_new_id uuid;
BEGIN
  FOR r IN
    SELECT m.id, m.numero_titolo
    FROM public.titoli m
    WHERE m.sostituisce_polizza IS NULL
      AND COALESCE(m.is_regolazione, false) = false
      AND COALESCE(m.is_appendice_modifica, false) = false
      AND COALESCE(m.is_proroga, false) = false
      AND m.numero_titolo IS NOT NULL
      AND (m.stato = 'incassato' OR m.data_messa_cassa IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM public.titoli q
        WHERE q.sostituisce_polizza = m.numero_titolo
          AND q.garanzia_da = m.garanzia_da
          AND COALESCE(q.is_regolazione, false) = false
      )
  LOOP
    v_new_id := public.fn_backfill_madre_incassata_crea_rata1(r.id);
    RAISE NOTICE 'Bonifica %: creata rata-1 %', r.numero_titolo, v_new_id;
  END LOOP;
END;
$$;
