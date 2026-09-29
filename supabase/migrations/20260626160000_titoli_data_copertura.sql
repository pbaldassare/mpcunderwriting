-- Data copertura: separa fase Garantito (copertura) da messa a cassa / incasso reale.

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS data_copertura date;

ALTER TABLE public.quietanze
  ADD COLUMN IF NOT EXISTS data_copertura date;

COMMENT ON COLUMN public.titoli.data_copertura IS
  'Data copertura garantita (Garantito). Distinta da data_messa_cassa (incasso reale).';

-- Migrazione soft: garantiti senza fondi trattati come incassati → fase copertura.
UPDATE public.titoli
SET
  data_copertura = COALESCE(data_copertura, data_messa_cassa, data_conferimento_gestito),
  data_messa_cassa = NULL,
  data_incasso = NULL,
  data_pagamento = NULL,
  importo_incassato = NULL,
  stato = 'attivo'
WHERE conferimento_gestito = true
  AND COALESCE(fondi_ricevuti, false) = false
  AND data_messa_cassa IS NOT NULL
  AND COALESCE(importo_incassato, 0) = 0
  AND stato = 'incassato';

UPDATE public.quietanze q
SET data_copertura = t.data_copertura
FROM public.titoli t
WHERE q.titolo_id = t.id
  AND t.data_copertura IS NOT NULL
  AND q.data_copertura IS NULL;

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
  t.regolazione_quietanza_id,
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

-- Estende annulla_quietanza_incasso: branch copertura-only + reset data_copertura.
CREATE OR REPLACE FUNCTION public.annulla_quietanza_incasso(p_titolo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo RECORD;
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_next_rata_id uuid;
  v_count_pag_righe int := 0;
  v_count_prov int := 0;
  v_count_rim_dett int := 0;
  v_count_rim_eliminate int := 0;
  v_count_mov_cont int := 0;
  v_count_anticipi int := 0;
  v_count_comp int := 0;
  v_count_next_rata int := 0;
  v_quietanze_agg int := 0;
  v_rimessa_bloccata text;
  v_result jsonb;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza, stato, data_messa_cassa, conferimento_gestito, data_copertura
    INTO v_titolo
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  -- Solo copertura garantita (nessun incasso): reset leggero.
  IF v_titolo.data_messa_cassa IS NULL
     AND COALESCE(v_titolo.conferimento_gestito, false) = true
     AND v_titolo.data_copertura IS NOT NULL THEN
    UPDATE public.titoli SET
      stato = 'attivo',
      data_copertura = NULL,
      data_decorrenza_rinnovo = NULL,
      tipo_pagamento = NULL,
      conferimento_gestito = false,
      fondi_ricevuti = true,
      data_conferimento_gestito = NULL,
      updated_at = now()
    WHERE id = p_titolo_id;

    UPDATE public.quietanze SET data_copertura = NULL, updated_at = now()
    WHERE titolo_id = p_titolo_id;
    GET DIAGNOSTICS v_quietanze_agg = ROW_COUNT;

    INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
    VALUES ('annulla_copertura_garantita', 'titolo', p_titolo_id, 'warning',
      jsonb_build_object('ok', true, 'quietanze_aggiornate', v_quietanze_agg), auth.uid());

    RETURN jsonb_build_object('ok', true, 'solo_copertura', true, 'quietanze_aggiornate', v_quietanze_agg);
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL AND v_titolo.data_messa_cassa IS NULL AND v_titolo.stato <> 'incassato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione valida solo su quietanze incassate, messe a cassa o in copertura garantita');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id AND pagata = true
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Impossibile annullare: esistono provvigioni già pagate per questo titolo.'
    );
  END IF;

  SELECT rp.stato INTO v_rimessa_bloccata
  FROM public.rimessa_dettaglio rd
  JOIN public.rimessa_premi rp ON rp.id = rd.rimessa_id
  WHERE rd.titolo_id = p_titolo_id
    AND rp.stato NOT IN ('bozza', 'annullata')
  LIMIT 1;

  IF v_rimessa_bloccata IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Impossibile annullare: titolo incluso in rimessa con stato "%s".', v_rimessa_bloccata)
    );
  END IF;

  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);

  SELECT array_agg(id) INTO v_prov_ids
  FROM public.provvigioni_generate WHERE titolo_id = p_titolo_id;
  IF v_prov_ids IS NULL THEN v_prov_ids := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(DISTINCT rimessa_id) INTO v_rimesse_ids
  FROM public.rimessa_dettaglio WHERE titolo_id = p_titolo_id;
  IF v_rimesse_ids IS NULL THEN v_rimesse_ids := ARRAY[]::uuid[]; END IF;

  IF array_length(v_prov_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.pagamenti_provvigioni_righe
      WHERE provvigione_id = ANY(v_prov_ids) RETURNING 1
    ) SELECT count(*) INTO v_count_pag_righe FROM d;
  END IF;

  WITH d AS (DELETE FROM public.provvigioni_generate WHERE titolo_id = p_titolo_id RETURNING 1)
  SELECT count(*) INTO v_count_prov FROM d;

  WITH d AS (DELETE FROM public.rimessa_dettaglio WHERE titolo_id = p_titolo_id RETURNING 1)
  SELECT count(*) INTO v_count_rim_dett FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_contabili
    WHERE riferimento_tipo = 'titolo' AND riferimento_id = p_titolo_id RETURNING 1
  ) SELECT count(*) INTO v_count_mov_cont FROM d;

  WITH d AS (DELETE FROM public.cliente_anticipi_utilizzi WHERE titolo_id = p_titolo_id RETURNING 1)
  SELECT count(*) INTO v_count_anticipi FROM d;

  WITH d AS (DELETE FROM public.titoli_compensazioni WHERE titolo_id = p_titolo_id RETURNING 1)
  SELECT count(*) INTO v_count_comp FROM d;

  SELECT id INTO v_next_rata_id
  FROM public.titoli
  WHERE sostituisce_polizza = v_titolo.numero_titolo
    AND ((v_titolo.riga IS NULL AND sostituisce_riga IS NULL) OR sostituisce_riga = v_titolo.riga)
    AND stato = 'attivo'
    AND data_messa_cassa IS NULL
    AND COALESCE(is_regolazione, false) = false
  LIMIT 1;

  IF v_next_rata_id IS NOT NULL THEN
    DELETE FROM public.quietanze WHERE titolo_id = v_next_rata_id;
    DELETE FROM public.titoli WHERE id = v_next_rata_id;
    v_count_next_rata := 1;
  END IF;

  IF array_length(v_rimesse_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.rimessa_premi rp
      WHERE rp.id = ANY(v_rimesse_ids)
        AND NOT EXISTS (SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.rimessa_id = rp.id)
      RETURNING 1
    ) SELECT count(*) INTO v_count_rim_eliminate FROM d;
  END IF;

  UPDATE public.titoli SET
    stato = 'attivo',
    data_messa_cassa = NULL,
    data_copertura = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    data_decorrenza_rinnovo = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    fondi_ricevuti = true,
    data_conferimento_gestito = NULL,
    updated_at = now()
  WHERE id = p_titolo_id;

  UPDATE public.quietanze SET
    stato = 'da_incassare',
    data_messa_cassa = NULL,
    data_copertura = NULL,
    data_pagamento = NULL,
    data_incasso = NULL,
    importo_incassato = NULL,
    tipo_incasso = NULL,
    conto_incasso = NULL,
    updated_at = now()
  WHERE titolo_id = p_titolo_id;
  GET DIAGNOSTICS v_quietanze_agg = ROW_COUNT;

  v_result := jsonb_build_object(
    'ok', true,
    'provvigioni_eliminate', v_count_prov,
    'pagamenti_righe_eliminate', v_count_pag_righe,
    'rimessa_dettagli_eliminati', v_count_rim_dett,
    'rimesse_testate_eliminate', v_count_rim_eliminate,
    'movimenti_eliminati', v_count_mov_cont,
    'anticipi_eliminati', v_count_anticipi,
    'compensazioni_eliminate', v_count_comp,
    'rata_successiva_eliminata', v_count_next_rata > 0,
    'quietanze_aggiornate', v_quietanze_agg
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_quietanza_incasso', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;
