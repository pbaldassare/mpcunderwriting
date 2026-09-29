-- Giroconti inter-cliente: quando l'acconto di un cliente PAGATORE salda la quietanza
-- di un altro cliente (es. capogruppo che paga per una collegata). Traccia esplicita
-- per gli estratti conto di entrambi + storno automatico all'annullo incasso.

-- ---------------------------------------------------------------------------
-- 1) Tabella partite di giroconto
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.giroconti_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  cliente_pagatore_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  cliente_beneficiario_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  anticipo_id uuid REFERENCES public.cliente_anticipi(id) ON DELETE SET NULL,
  importo numeric(14,2) NOT NULL CHECK (importo > 0),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_giroconti_pagatore ON public.giroconti_cliente(cliente_pagatore_id);
CREATE INDEX IF NOT EXISTS idx_giroconti_beneficiario ON public.giroconti_cliente(cliente_beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_giroconti_titolo ON public.giroconti_cliente(titolo_id);

COMMENT ON TABLE public.giroconti_cliente IS
  'Partite inter-cliente: acconto del pagatore usato per saldare la quietanza di un altro cliente. Compare negli EC di entrambi.';

-- ---------------------------------------------------------------------------
-- 2) RLS (stessa convenzione di cliente_anticipi)
-- ---------------------------------------------------------------------------
ALTER TABLE public.giroconti_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff gestisce giroconti" ON public.giroconti_cliente;
CREATE POLICY "Staff gestisce giroconti" ON public.giroconti_cliente
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.ruolo = ANY (ARRAY['admin','cfo','ufficio','backoffice','contabilita','manager'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.ruolo = ANY (ARRAY['admin','cfo','ufficio','backoffice','contabilita','manager'])));

DROP POLICY IF EXISTS "Cliente vede propri giroconti" ON public.giroconti_cliente;
CREATE POLICY "Cliente vede propri giroconti" ON public.giroconti_cliente
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.clienti c WHERE c.id = giroconti_cliente.cliente_pagatore_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.clienti c WHERE c.id = giroconti_cliente.cliente_beneficiario_id AND c.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.giroconti_cliente TO authenticated;
GRANT ALL ON public.giroconti_cliente TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Estende annulla_quietanza_incasso: storna anche i giroconti del titolo
-- ---------------------------------------------------------------------------
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
  v_count_giroconti int := 0;
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

  -- Storno partite di giroconto inter-cliente collegate al titolo
  WITH d AS (DELETE FROM public.giroconti_cliente WHERE titolo_id = p_titolo_id RETURNING 1)
  SELECT count(*) INTO v_count_giroconti FROM d;

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
    'giroconti_eliminati', v_count_giroconti,
    'rata_successiva_eliminata', v_count_next_rata > 0,
    'quietanze_aggiornate', v_quietanze_agg
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_quietanza_incasso', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.annulla_quietanza_incasso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_quietanza_incasso(uuid) TO service_role;
