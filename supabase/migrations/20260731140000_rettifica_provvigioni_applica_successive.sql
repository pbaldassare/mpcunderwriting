-- Estende rettifica_provvigioni_quietanza: flag per aggiornare le quietanze successive
-- non ancora contabilizzate con il nuovo importo (senza delta contabile).

DROP FUNCTION IF EXISTS public.rettifica_provvigioni_quietanza(uuid, numeric, text, date);

CREATE OR REPLACE FUNCTION public.rettifica_provvigioni_quietanza(
  p_titolo_id uuid,
  p_nuovo_importo numeric,
  p_note text,
  p_data_rettifica date DEFAULT CURRENT_DATE,
  p_applica_successive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo record;
  v_vecchio numeric;
  v_delta numeric;
  v_has_paid boolean;
  v_in_rimessa boolean;
  v_quietanza_id uuid;
  v_rettifica_titolo_id uuid;
  v_numero_rp text;
  v_seq int;
  v_base_numero text;
  v_prov_rows record;
  v_total_weight numeric;
  v_assigned numeric;
  v_portion numeric;
  v_last_idx int := -1;
  v_idx int := 0;
  v_regen_count int := 0;
  v_corr_count int := 0;
  v_ufficio_id uuid;
  v_polizza_key text;
  v_successive_count int := 0;
  v_succ record;
BEGIN
  IF trim(COALESCE(p_note, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Note obbligatorie sulla rettifica');
  END IF;

  IF p_nuovo_importo IS NULL OR p_nuovo_importo < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Importo provvigione non valido');
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'cfo'::app_role)
    OR public.has_role(auth.uid(), 'ufficio'::app_role)
    OR public.has_role(auth.uid(), 'contabilita'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permesso negato');
  END IF;

  SELECT t.* INTO v_titolo
  FROM public.titoli t
  WHERE t.id = p_titolo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL AND COALESCE(v_titolo.is_regolazione, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Selezionare una quietanza/rata, non una polizza madre');
  END IF;

  IF COALESCE(v_titolo.is_regolazione, false) = true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non è possibile rettificare un titolo di regolazione');
  END IF;

  IF v_titolo.stato <> 'incassato' AND v_titolo.data_messa_cassa IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La quietanza deve essere incassata o messa a cassa');
  END IF;

  v_vecchio := round(COALESCE(v_titolo.provvigioni_quietanza, 0)::numeric, 2);
  v_delta := round((p_nuovo_importo - v_vecchio)::numeric, 2);

  IF v_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nessuna variazione rispetto all''importo attuale');
  END IF;

  SELECT u.ufficio_id INTO v_ufficio_id
  FROM public.profiles u
  WHERE u.id = auth.uid();

  UPDATE public.titoli SET
    provvigioni_quietanza = round(p_nuovo_importo::numeric, 2),
    updated_at = now()
  WHERE id = p_titolo_id;

  UPDATE public.quietanze SET
    provvigioni_quietanza = round(p_nuovo_importo::numeric, 2),
    updated_at = now()
  WHERE titolo_id = p_titolo_id;

  SELECT EXISTS (
    SELECT 1 FROM public.provvigioni_generate pg
    WHERE pg.titolo_id = p_titolo_id AND COALESCE(pg.pagata, false) = true
  ) INTO v_has_paid;

  SELECT q.id INTO v_quietanza_id
  FROM public.quietanze q
  WHERE q.titolo_id = p_titolo_id
  LIMIT 1;

  IF v_has_paid THEN
    DELETE FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id AND COALESCE(pagata, false) = false;

    SELECT COALESCE(sum(
      CASE
        WHEN COALESCE(percentuale, 0) > 0 THEN percentuale
        WHEN COALESCE(importo_provvigione, 0) <> 0 THEN abs(importo_provvigione)
        ELSE 0
      END
    ), 0) INTO v_total_weight
    FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id;

    v_assigned := 0;
    v_idx := 0;

    FOR v_prov_rows IN
      SELECT id, user_id, anagrafica_commerciale_id, percentuale, importo_provvigione,
             tipo_destinatario, solo_statistico
      FROM public.provvigioni_generate
      WHERE titolo_id = p_titolo_id
        AND COALESCE(solo_statistico, false) = false
      ORDER BY id
    LOOP
      v_last_idx := v_idx;
      v_idx := v_idx + 1;

      IF v_total_weight > 0 THEN
        v_portion := round((
          v_delta * CASE
            WHEN COALESCE(v_prov_rows.percentuale, 0) > 0 THEN v_prov_rows.percentuale
            ELSE abs(COALESCE(v_prov_rows.importo_provvigione, 0))
          END / v_total_weight
        )::numeric, 2);
      ELSE
        v_portion := round((v_delta / GREATEST(v_idx, 1))::numeric, 2);
      END IF;

      v_assigned := v_assigned + v_portion;

      IF v_portion <> 0 THEN
        INSERT INTO public.provvigioni_generate (
          titolo_id, quietanza_id, user_id, anagrafica_commerciale_id,
          percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata
        ) VALUES (
          p_titolo_id, v_quietanza_id, v_prov_rows.user_id, v_prov_rows.anagrafica_commerciale_id,
          v_prov_rows.percentuale,
          v_portion,
          COALESCE(v_prov_rows.tipo_destinatario, 'commerciale'),
          false,
          false
        );
        v_corr_count := v_corr_count + 1;
      END IF;
    END LOOP;

    IF v_last_idx >= 0 AND round((v_delta - v_assigned)::numeric, 2) <> 0 THEN
      UPDATE public.provvigioni_generate SET
        importo_provvigione = round((importo_provvigione + (v_delta - v_assigned))::numeric, 2)
      WHERE id = (
        SELECT pg.id FROM public.provvigioni_generate pg
        WHERE pg.titolo_id = p_titolo_id
          AND COALESCE(pg.pagata, false) = false
          AND COALESCE(pg.solo_statistico, false) = false
        ORDER BY pg.calcolata_il DESC NULLS LAST, pg.id DESC
        LIMIT 1
      );
    END IF;
  ELSE
    v_regen_count := public.fn_rigenera_provvigioni_generate(p_titolo_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.titolo_id = p_titolo_id
  ) INTO v_in_rimessa;

  v_rettifica_titolo_id := NULL;

  IF v_in_rimessa AND v_delta <> 0 THEN
    v_base_numero := split_part(COALESCE(v_titolo.numero_titolo, ''), '/', 1);
    IF v_base_numero = '' THEN
      v_base_numero := COALESCE(v_titolo.numero_titolo, 'RT');
    END IF;

    SELECT COALESCE(count(*), 0) + 1 INTO v_seq
    FROM public.titoli
    WHERE numero_titolo LIKE (v_base_numero || '/RP%');

    v_numero_rp := v_base_numero || '/RP' || v_seq::text;

    INSERT INTO public.titoli (
      numero_titolo, riga, stato,
      is_regolazione, regolazione_quietanza_id,
      sostituisce_polizza, sostituisce_riga,
      cliente_id, cliente_anagrafica_id,
      prodotto_id, prodotto_nome,
      ufficio_id, produttore_id, produttore_nome,
      compagnia_id, compagnia_rapporto_id, codice_rapporto,
      ramo_id, specialist,
      commerciale_id, anagrafica_commerciale_id,
      percentuale_commerciale, percentuale_riparto, tipo_mandatario,
      ae_anagrafica_id, ae_nome, percentuale_ae,
      descrizione_polizza, note,
      garanzia_da, garanzia_a, data_scadenza,
      premio_netto, tasse, premio_lordo, importo_incassato,
      provvigioni_firma, provvigioni_quietanza,
      data_messa_cassa, data_incasso,
      tipo_portafoglio, conferimento_gestito, fondi_ricevuti
    ) VALUES (
      v_numero_rp, COALESCE(v_titolo.riga, 1),
      'incassato',
      true, p_titolo_id,
      v_titolo.sostituisce_polizza, v_titolo.sostituisce_riga,
      v_titolo.cliente_id, v_titolo.cliente_anagrafica_id,
      v_titolo.prodotto_id, v_titolo.prodotto_nome,
      v_titolo.ufficio_id, v_titolo.produttore_id, v_titolo.produttore_nome,
      v_titolo.compagnia_id, v_titolo.compagnia_rapporto_id, v_titolo.codice_rapporto,
      v_titolo.ramo_id, v_titolo.specialist,
      v_titolo.commerciale_id, v_titolo.anagrafica_commerciale_id,
      v_titolo.percentuale_commerciale, v_titolo.percentuale_riparto, v_titolo.tipo_mandatario,
      v_titolo.ae_anagrafica_id, v_titolo.ae_nome, v_titolo.percentuale_ae,
      'Rettifica provvigioni quietanza ' || COALESCE(v_titolo.numero_titolo, ''),
      left(trim(p_note), 500),
      v_titolo.garanzia_da, v_titolo.garanzia_a, v_titolo.data_scadenza,
      0, 0, 0, 0,
      0, v_delta,
      p_data_rettifica, p_data_rettifica,
      v_titolo.tipo_portafoglio, false, true
    )
    RETURNING id INTO v_rettifica_titolo_id;
  END IF;

  -- Quietanze successive non ancora a cassa: scrivi il nuovo importo (nessun delta contabile).
  v_polizza_key := nullif(trim(COALESCE(v_titolo.sostituisce_polizza, '')), '');
  IF COALESCE(p_applica_successive, false) AND v_polizza_key IS NOT NULL THEN
    FOR v_succ IN
      SELECT t.id
      FROM public.titoli t
      WHERE t.sostituisce_polizza = v_polizza_key
        AND t.id <> p_titolo_id
        AND COALESCE(t.is_regolazione, false) = false
        AND t.data_messa_cassa IS NULL
        AND t.stato IS DISTINCT FROM 'incassato'
        AND t.stato IS DISTINCT FROM 'annullato'
        AND (
          CASE
            WHEN v_titolo.riga IS NOT NULL AND t.riga IS NOT NULL THEN t.riga > v_titolo.riga
            ELSE (
              t.garanzia_da IS NOT NULL
              AND v_titolo.garanzia_da IS NOT NULL
              AND t.garanzia_da > v_titolo.garanzia_da
            )
          END
        )
      FOR UPDATE
    LOOP
      UPDATE public.titoli SET
        provvigioni_quietanza = round(p_nuovo_importo::numeric, 2),
        updated_at = now()
      WHERE id = v_succ.id;

      UPDATE public.quietanze SET
        provvigioni_quietanza = round(p_nuovo_importo::numeric, 2),
        updated_at = now()
      WHERE titolo_id = v_succ.id;

      v_successive_count := v_successive_count + 1;
    END LOOP;
  END IF;

  INSERT INTO public.log_attivita (
    user_id, ufficio_id, azione, entita_tipo, entita_id, severity, dettagli_json
  ) VALUES (
    auth.uid(),
    COALESCE(v_ufficio_id, v_titolo.ufficio_id),
    'rettifica_provvigioni_quietanza',
    'titolo',
    p_titolo_id,
    CASE WHEN abs(v_delta) > 500 THEN 'warning' ELSE 'info' END,
    jsonb_build_object(
      'titolo_id', p_titolo_id,
      'numero_titolo', v_titolo.numero_titolo,
      'vecchio', v_vecchio,
      'nuovo', round(p_nuovo_importo::numeric, 2),
      'delta', v_delta,
      'note', left(trim(p_note), 1000),
      'data_rettifica', p_data_rettifica,
      'in_rimessa', v_in_rimessa,
      'rettifica_titolo_ec_id', v_rettifica_titolo_id,
      'provvigioni_rigenerate', v_regen_count,
      'provvigioni_rettifica_righe', v_corr_count,
      'had_paid_provvigioni', v_has_paid,
      'applica_successive', COALESCE(p_applica_successive, false),
      'successive_aggiornate', v_successive_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'titolo_id', p_titolo_id,
    'vecchio', v_vecchio,
    'nuovo', round(p_nuovo_importo::numeric, 2),
    'delta', v_delta,
    'in_rimessa', v_in_rimessa,
    'rettifica_titolo_ec_id', v_rettifica_titolo_id,
    'provvigioni_rigenerate', v_regen_count,
    'provvigioni_rettifica_righe', v_corr_count,
    'had_paid_provvigioni', v_has_paid,
    'applica_successive', COALESCE(p_applica_successive, false),
    'successive_aggiornate', v_successive_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rettifica_provvigioni_quietanza(uuid, numeric, text, date, boolean) TO authenticated;

COMMENT ON FUNCTION public.rettifica_provvigioni_quietanza IS
  'Rettifica provvigioni_quietanza su quietanza a cassa (delta contabile). Opzionalmente aggiorna le rate successive non contabilizzate con il nuovo importo.';
