-- Modalità incasso per titolo (es. produttore trattiene provvigioni).
-- Persistenza strutturata per E/C produttore, report e rettifiche a posteriori.

CREATE TABLE IF NOT EXISTS public.titoli_modalita_incasso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  modalita text NOT NULL DEFAULT 'standard'
    CHECK (modalita IN ('standard', 'produttore_trattiene_provv')),
  anagrafica_commerciale_id uuid REFERENCES public.anagrafiche_professionali(id) ON DELETE SET NULL,
  importo_dovuto_lordo numeric(14,2),
  importo_provvigione_lorda numeric(14,2),
  importo_ra numeric(14,2),
  importo_trattenuto_netto numeric(14,2),
  importo_versato_consul numeric(14,2),
  stato text NOT NULL DEFAULT 'attiva' CHECK (stato IN ('attiva', 'annullata')),
  note text,
  applicata_il timestamptz NOT NULL DEFAULT now(),
  applicata_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  annullata_il timestamptz,
  annullata_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_titoli_modalita_incasso_attiva
  ON public.titoli_modalita_incasso (titolo_id)
  WHERE stato = 'attiva';

CREATE INDEX IF NOT EXISTS idx_titoli_modalita_incasso_prod
  ON public.titoli_modalita_incasso (anagrafica_commerciale_id, applicata_il)
  WHERE stato = 'attiva' AND modalita = 'produttore_trattiene_provv';

COMMENT ON TABLE public.titoli_modalita_incasso IS
  'Snapshot modalità incasso per titolo. produttore_trattiene_provv: provvigione già liquidata dal produttore; esclusa da E/C da pagare, voce separata.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titoli_modalita_incasso TO authenticated;
GRANT ALL ON public.titoli_modalita_incasso TO service_role;

ALTER TABLE public.titoli_modalita_incasso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access titoli_modalita_incasso" ON public.titoli_modalita_incasso;
CREATE POLICY "Authenticated full access titoli_modalita_incasso"
  ON public.titoli_modalita_incasso FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_titoli_modalita_incasso_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_modalita_incasso_updated_at ON public.titoli_modalita_incasso;
CREATE TRIGGER trg_titoli_modalita_incasso_updated_at
  BEFORE UPDATE ON public.titoli_modalita_incasso
  FOR EACH ROW EXECUTE FUNCTION public.tg_titoli_modalita_incasso_updated_at();

-- Rettifica modalità su titolo già incassato
CREATE OR REPLACE FUNCTION public.rettifica_modalita_incasso_titolo(
  p_titolo_id uuid,
  p_modalita text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titolo RECORD;
  v_prod RECORD;
  v_prov numeric;
  v_ra_pct numeric;
  v_ra numeric;
  v_trattenuto numeric;
  v_versato numeric;
  v_old RECORD;
  v_delta numeric := 0;
BEGIN
  IF p_modalita NOT IN ('standard', 'produttore_trattiene_provv') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Modalità non valida');
  END IF;

  SELECT t.id, t.stato, t.data_messa_cassa, t.importo_incassato, t.premio_lordo,
         t.anagrafica_commerciale_id, t.provvigioni_quietanza, t.percentuale_commerciale
    INTO v_titolo
  FROM public.titoli t WHERE t.id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  IF v_titolo.stato <> 'incassato' OR v_titolo.data_messa_cassa IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rettifica valida solo su titoli incassati');
  END IF;

  SELECT * INTO v_old
  FROM public.titoli_modalita_incasso
  WHERE titolo_id = p_titolo_id AND stato = 'attiva'
  LIMIT 1;

  IF v_old.id IS NOT NULL THEN
    UPDATE public.titoli_modalita_incasso SET
      stato = 'annullata',
      annullata_il = now(),
      annullata_da = auth.uid()
    WHERE id = v_old.id;

    IF v_old.modalita = 'produttore_trattiene_provv' THEN
      v_delta := v_delta + COALESCE(v_old.importo_trattenuto_netto, 0);
      UPDATE public.provvigioni_generate SET pagata = false
      WHERE titolo_id = p_titolo_id
        AND tipo_destinatario = 'commerciale'
        AND anagrafica_commerciale_id IS NOT DISTINCT FROM v_old.anagrafica_commerciale_id;
    END IF;
  END IF;

  IF p_modalita = 'produttore_trattiene_provv' THEN
    IF v_titolo.anagrafica_commerciale_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Titolo senza produttore commerciale');
    END IF;

    SELECT id, percentuale_ra, ragione_sociale, cognome, nome
      INTO v_prod
    FROM public.anagrafiche_professionali
    WHERE id = v_titolo.anagrafica_commerciale_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Produttore non trovato');
    END IF;

    v_prov := round((COALESCE(v_titolo.provvigioni_quietanza, 0)
      * LEAST(GREATEST(COALESCE(v_titolo.percentuale_commerciale, 100), 0), 100) / 100)::numeric, 2);
    IF v_prov <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Nessuna provvigione produttore da trattenere');
    END IF;

    v_ra_pct := COALESCE(v_prod.percentuale_ra, 0);
    v_ra := round((v_prov * v_ra_pct / 100)::numeric, 2);
    v_trattenuto := round((v_prov - v_ra)::numeric, 2);
    v_versato := round((GREATEST(COALESCE(v_titolo.importo_incassato, 0), 0))::numeric, 2);

    INSERT INTO public.titoli_modalita_incasso (
      titolo_id, modalita, anagrafica_commerciale_id,
      importo_dovuto_lordo, importo_provvigione_lorda, importo_ra,
      importo_trattenuto_netto, importo_versato_consul, note, applicata_da
    ) VALUES (
      p_titolo_id, 'produttore_trattiene_provv', v_titolo.anagrafica_commerciale_id,
      COALESCE(v_titolo.premio_lordo, 0), v_prov, v_ra, v_trattenuto, v_versato,
      p_note, auth.uid()
    );

    v_delta := v_delta - v_trattenuto;

    UPDATE public.provvigioni_generate SET pagata = true
    WHERE titolo_id = p_titolo_id
      AND tipo_destinatario = 'commerciale'
      AND anagrafica_commerciale_id = v_titolo.anagrafica_commerciale_id;
  END IF;

  IF v_delta <> 0 THEN
    UPDATE public.titoli SET
      importo_incassato = GREATEST(0, round((COALESCE(importo_incassato, 0) + v_delta)::numeric, 2)),
      updated_at = now()
    WHERE id = p_titolo_id;
  END IF;

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES (
    'rettifica_modalita_incasso',
    'titolo',
    p_titolo_id,
    'info',
    jsonb_build_object('modalita', p_modalita, 'note', p_note, 'delta_importo_incassato', v_delta),
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'modalita', p_modalita, 'delta_importo_incassato', v_delta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rettifica_modalita_incasso_titolo(uuid, text, text) TO authenticated;

-- Annulla incasso: elimina modalità e consente annullo se provvigioni pagate solo per trattenuta
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
  v_count_modalita int := 0;
  v_count_next_rata int := 0;
  v_quietanze_agg int := 0;
  v_rimessa_bloccata text;
  v_result jsonb;
  v_ha_trattenuta boolean;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza, stato, data_messa_cassa
    INTO v_titolo
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Titolo non trovato');
  END IF;

  IF v_titolo.sostituisce_polizza IS NULL AND v_titolo.data_messa_cassa IS NULL AND v_titolo.stato <> 'incassato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operazione valida solo su quietanze incassate o messe a cassa');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.titoli_modalita_incasso
    WHERE titolo_id = p_titolo_id AND stato = 'attiva' AND modalita = 'produttore_trattiene_provv'
  ) INTO v_ha_trattenuta;

  IF v_ha_trattenuta THEN
    UPDATE public.provvigioni_generate SET pagata = false
    WHERE titolo_id = p_titolo_id AND pagata = true AND tipo_destinatario = 'commerciale';
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

  WITH d AS (
    DELETE FROM public.titoli_modalita_incasso WHERE titolo_id = p_titolo_id RETURNING 1
  )
  SELECT count(*) INTO v_count_modalita FROM d;

  SELECT array_agg(id) INTO v_prov_ids
  FROM public.provvigioni_generate
  WHERE titolo_id = p_titolo_id;
  IF v_prov_ids IS NULL THEN v_prov_ids := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(DISTINCT rimessa_id) INTO v_rimesse_ids
  FROM public.rimessa_dettaglio
  WHERE titolo_id = p_titolo_id;
  IF v_rimesse_ids IS NULL THEN v_rimesse_ids := ARRAY[]::uuid[]; END IF;

  IF array_length(v_prov_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM public.pagamenti_provvigioni_righe
      WHERE provvigione_id = ANY(v_prov_ids)
      RETURNING 1
    )
    SELECT count(*) INTO v_count_pag_righe FROM d;
  END IF;

  WITH d AS (
    DELETE FROM public.provvigioni_generate
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_prov FROM d;

  WITH d AS (
    DELETE FROM public.rimessa_dettaglio
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_rim_dett FROM d;

  WITH d AS (
    DELETE FROM public.movimenti_contabili
    WHERE riferimento_tipo = 'titolo' AND riferimento_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_mov_cont FROM d;

  WITH d AS (
    DELETE FROM public.cliente_anticipi_utilizzi
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count_anticipi FROM d;

  WITH d AS (
    DELETE FROM public.titoli_compensazioni
    WHERE titolo_id = p_titolo_id
    RETURNING 1
  )
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
    )
    SELECT count(*) INTO v_count_rim_eliminate FROM d;
  END IF;

  UPDATE public.titoli SET
    stato = 'attivo',
    data_messa_cassa = NULL,
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
    'modalita_incasso_eliminate', v_count_modalita,
    'rata_successiva_eliminata', v_count_next_rata > 0,
    'quietanze_aggiornate', v_quietanze_agg
  );

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES ('annulla_quietanza_incasso', 'titolo', p_titolo_id, 'warning', v_result, auth.uid());

  RETURN v_result;
END;
$$;
