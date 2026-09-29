-- Merge COMUNE DI SANTA MARINA SALINA (legacy 1000065 → master 1000117)
-- + RPC verifica duplicati clienti/polizze + unique P.IVA attivi

DO $$
DECLARE
  v_master uuid := '9684bb6c-8014-4ffd-ae9d-622f8ec3b748';
  v_legacy uuid := '1b4e00d5-02d7-4c53-ac90-bcafa057f77c';
  v_snapshot jsonb;
  v_titoli int := 0;
  v_sinistri int := 0;
  v_documenti int := 0;
  v_trattative int := 0;
  v_codici int := 0;
  v_nominativi int := 0;
  v_privacy int := 0;
  v_canali int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clienti WHERE id = v_master AND merged_into IS NULL) THEN
    RAISE NOTICE 'Master Santa Marina Salina già assente o merged, skip merge';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clienti WHERE id = v_legacy AND merged_into IS NULL) THEN
    RAISE NOTICE 'Legacy Santa Marina Salina già merged, skip merge';
    RETURN;
  END IF;

  SELECT to_jsonb(c.*) INTO v_snapshot FROM public.clienti c WHERE c.id = v_legacy;

  -- Arricchisci master con dati utili del legacy (solo campi vuoti)
  UPDATE public.clienti m
  SET
    email = COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(l.email), '')),
    pec = COALESCE(NULLIF(TRIM(m.pec), ''), NULLIF(TRIM(l.pec), '')),
    telefono = COALESCE(NULLIF(TRIM(m.telefono), ''), NULLIF(TRIM(l.telefono), '')),
    cellulare = COALESCE(NULLIF(TRIM(m.cellulare), ''), NULLIF(TRIM(l.cellulare), '')),
    citta_sede = COALESCE(NULLIF(TRIM(m.citta_sede), ''), NULLIF(TRIM(l.citta_sede), ''))
  FROM public.clienti l
  WHERE m.id = v_master AND l.id = v_legacy;

  UPDATE public.titoli SET cliente_anagrafica_id = v_master WHERE cliente_anagrafica_id = v_legacy;
  GET DIAGNOSTICS v_titoli = ROW_COUNT;

  UPDATE public.sinistri SET cliente_anagrafica_id = v_master WHERE cliente_anagrafica_id = v_legacy;
  GET DIAGNOSTICS v_sinistri = ROW_COUNT;

  UPDATE public.documenti SET entita_id = v_master WHERE entita_tipo = 'cliente' AND entita_id = v_legacy;
  GET DIAGNOSTICS v_documenti = ROW_COUNT;

  UPDATE public.trattative SET cliente_id = v_master WHERE cliente_id = v_legacy;
  GET DIAGNOSTICS v_trattative = ROW_COUNT;

  DELETE FROM public.codici_commerciali_cliente l
  WHERE l.cliente_id = v_legacy
    AND EXISTS (
      SELECT 1 FROM public.codici_commerciali_cliente m
      WHERE m.cliente_id = v_master AND m.ruolo = l.ruolo
    );

  UPDATE public.codici_commerciali_cliente SET cliente_id = v_master WHERE cliente_id = v_legacy;
  GET DIAGNOSTICS v_codici = ROW_COUNT;

  UPDATE public.nominativi_cliente SET cliente_id = v_master WHERE cliente_id = v_legacy;
  GET DIAGNOSTICS v_nominativi = ROW_COUNT;

  UPDATE public.privacy_consensi SET cliente_id = v_master WHERE cliente_id = v_legacy;
  GET DIAGNOSTICS v_privacy = ROW_COUNT;

  UPDATE public.chat_canali SET entita_id = v_master::text WHERE entita_tipo = 'cliente' AND entita_id = v_legacy::text;
  GET DIAGNOSTICS v_canali = ROW_COUNT;

  UPDATE public.clienti
  SET attivo = false,
      merged_into = v_master,
      merged_at = now(),
      note = COALESCE(note, '') || ' [MERGED in ' || v_master::text || ' il ' || to_char(now(), 'YYYY-MM-DD') || ']'
  WHERE id = v_legacy;

  INSERT INTO public.clienti_merge_log (cliente_master_id, cliente_legacy_id, snapshot_legacy, entita_spostate, note)
  VALUES (
    v_master,
    v_legacy,
    v_snapshot,
    jsonb_build_object(
      'titoli', v_titoli, 'sinistri', v_sinistri, 'documenti', v_documenti,
      'trattative', v_trattative, 'codici_commerciali', v_codici,
      'nominativi', v_nominativi, 'privacy_consensi', v_privacy, 'chat_canali', v_canali
    ),
    'Merge automatico COMUNE DI SANTA MARINA SALINA (1000065 → 1000117)'
  );
END $$;

-- Verifica duplicati cliente in creazione/modifica
CREATE OR REPLACE FUNCTION public.verifica_cliente_duplicato(
  _partita_iva text DEFAULT NULL,
  _codice_fiscale text DEFAULT NULL,
  _codice_fiscale_azienda text DEFAULT NULL,
  _nome text DEFAULT NULL,
  _cognome text DEFAULT NULL,
  _ragione_sociale text DEFAULT NULL,
  _tipo_cliente text DEFAULT NULL,
  _exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
  cliente_id uuid,
  codice_cliente text,
  denominazione text,
  match_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_piva text := NULLIF(TRIM(_partita_iva), '');
  v_cf text := NULLIF(UPPER(TRIM(_codice_fiscale)), '');
  v_cf_az text := NULLIF(UPPER(TRIM(_codice_fiscale_azienda)), '');
  v_nome_norm text;
BEGIN
  IF v_piva IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.codice_cliente,
      TRIM(COALESCE(c.ragione_sociale, c.cognome || ' ' || c.nome, ''))::text,
      'partita_iva'::text
    FROM public.clienti c
    WHERE c.merged_into IS NULL
      AND c.attivo = true
      AND TRIM(c.partita_iva) = v_piva
      AND (_exclude_id IS NULL OR c.id <> _exclude_id)
    LIMIT 5;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF v_cf IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.codice_cliente,
      TRIM(COALESCE(c.cognome || ' ' || c.nome, c.ragione_sociale, ''))::text,
      'codice_fiscale'::text
    FROM public.clienti c
    WHERE c.merged_into IS NULL
      AND c.attivo = true
      AND UPPER(TRIM(c.codice_fiscale)) = v_cf
      AND (_exclude_id IS NULL OR c.id <> _exclude_id)
    LIMIT 5;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF v_cf_az IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.codice_cliente,
      TRIM(COALESCE(c.ragione_sociale, ''))::text,
      'codice_fiscale'::text
    FROM public.clienti c
    WHERE c.merged_into IS NULL
      AND c.attivo = true
      AND UPPER(TRIM(c.codice_fiscale_azienda)) = v_cf_az
      AND (_exclude_id IS NULL OR c.id <> _exclude_id)
    LIMIT 5;
    IF FOUND THEN RETURN; END IF;
  END IF;

  v_nome_norm := TRIM(BOTH ' ' FROM UPPER(REGEXP_REPLACE(
    COALESCE(_cognome, '') || ' ' || COALESCE(_nome, '') || ' ' || COALESCE(_ragione_sociale, ''),
    '\s+', ' ', 'g'
  )));
  IF v_nome_norm <> '' AND LENGTH(v_nome_norm) > 3 THEN
    RETURN QUERY
    SELECT c.id, c.codice_cliente,
      TRIM(COALESCE(c.ragione_sociale, c.cognome || ' ' || c.nome, ''))::text,
      'nome'::text
    FROM public.clienti c
    WHERE c.merged_into IS NULL
      AND c.attivo = true
      AND (_exclude_id IS NULL OR c.id <> _exclude_id)
      AND TRIM(BOTH ' ' FROM UPPER(REGEXP_REPLACE(
        COALESCE(c.cognome, '') || ' ' || COALESCE(c.nome, '') || ' ' || COALESCE(c.ragione_sociale, ''),
        '\s+', ' ', 'g'
      ))) = v_nome_norm
    LIMIT 5;
  END IF;
END;
$$;

-- Verifica numero polizza madre duplicato (stessa compagnia)
CREATE OR REPLACE FUNCTION public.verifica_numero_polizza_duplicato(
  _numero_titolo text,
  _compagnia_id uuid DEFAULT NULL,
  _exclude_titolo_id uuid DEFAULT NULL
)
RETURNS TABLE(
  duplicato boolean,
  titolo_id uuid,
  numero_titolo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS duplicato,
    t.id AS titolo_id,
    t.numero_titolo
  FROM public.titoli t
  WHERE TRIM(t.numero_titolo) = TRIM(_numero_titolo)
    AND t.sostituisce_polizza IS NULL
    AND t.stato IS DISTINCT FROM 'annullato'
    AND (_compagnia_id IS NULL OR t.compagnia_id IS NOT DISTINCT FROM _compagnia_id)
    AND (_exclude_titolo_id IS NULL OR t.id <> _exclude_titolo_id)
  LIMIT 1;
$$;

-- Unique P.IVA su clienti attivi non merged (dopo merge Santa Marina)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clienti_partita_iva_attivi
  ON public.clienti (TRIM(partita_iva))
  WHERE merged_into IS NULL
    AND attivo = true
    AND partita_iva IS NOT NULL
    AND TRIM(partita_iva) <> '';

-- Fix merge_cliente_atomico: gestisce conflitto ruoli codici commerciali
CREATE OR REPLACE FUNCTION public.merge_cliente_atomico(_master_id uuid, _legacy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_snapshot jsonb;
  v_titoli int := 0;
  v_sinistri int := 0;
  v_documenti int := 0;
  v_trattative int := 0;
  v_codici int := 0;
  v_nominativi int := 0;
  v_privacy int := 0;
  v_canali int := 0;
BEGIN
  SELECT ruolo INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin','responsabile_sede') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin o responsabile_sede';
  END IF;

  IF _master_id = _legacy_id THEN
    RAISE EXCEPTION 'Master e legacy non possono coincidere';
  END IF;

  SELECT to_jsonb(c.*) INTO v_snapshot FROM public.clienti c WHERE c.id = _legacy_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Cliente legacy non trovato';
  END IF;

  UPDATE public.titoli SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_titoli = ROW_COUNT;

  UPDATE public.sinistri SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_sinistri = ROW_COUNT;

  UPDATE public.documenti SET entita_id = _master_id WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id;
  GET DIAGNOSTICS v_documenti = ROW_COUNT;

  UPDATE public.trattative SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_trattative = ROW_COUNT;

  DELETE FROM public.codici_commerciali_cliente l
  WHERE l.cliente_id = _legacy_id
    AND EXISTS (
      SELECT 1 FROM public.codici_commerciali_cliente m
      WHERE m.cliente_id = _master_id AND m.ruolo = l.ruolo
    );

  UPDATE public.codici_commerciali_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_codici = ROW_COUNT;

  UPDATE public.nominativi_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_nominativi = ROW_COUNT;

  UPDATE public.privacy_consensi SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_privacy = ROW_COUNT;

  UPDATE public.chat_canali SET entita_id = _master_id::text WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id::text;
  GET DIAGNOSTICS v_canali = ROW_COUNT;

  UPDATE public.clienti
  SET attivo = false,
      merged_into = _master_id,
      merged_at = now(),
      merged_by = auth.uid(),
      note = COALESCE(note,'') || ' [MERGED in ' || _master_id::text || ' il ' || to_char(now(),'YYYY-MM-DD') || ']'
  WHERE id = _legacy_id;

  INSERT INTO public.clienti_merge_log (cliente_master_id, cliente_legacy_id, snapshot_legacy, entita_spostate, eseguito_da)
  VALUES (
    _master_id, _legacy_id, v_snapshot,
    jsonb_build_object(
      'titoli', v_titoli, 'sinistri', v_sinistri, 'documenti', v_documenti,
      'trattative', v_trattative, 'codici_commerciali', v_codici,
      'nominativi', v_nominativi, 'privacy_consensi', v_privacy, 'chat_canali', v_canali
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'master_id', _master_id,
    'legacy_id', _legacy_id,
    'spostate', jsonb_build_object(
      'titoli', v_titoli, 'sinistri', v_sinistri, 'documenti', v_documenti,
      'trattative', v_trattative, 'codici_commerciali', v_codici,
      'nominativi', v_nominativi, 'privacy_consensi', v_privacy, 'chat_canali', v_canali
    )
  );
END;
$$;
