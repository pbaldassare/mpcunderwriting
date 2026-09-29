-- ============================================
-- PARTE A: Fix immediato Lo Giudice + Parte B: Infrastruttura deduplica
-- ============================================

-- ====== PARTE A: Migra dati Lo Giudice (record legacy → master pulito) ======

-- 1. Migra polizze (3 attese)
UPDATE public.titoli
SET cliente_anagrafica_id = '746aed8c-67fc-435e-9e88-70991ea03097'
WHERE cliente_anagrafica_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';

-- 2. Migra codici commerciali (2 attesi)
UPDATE public.codici_commerciali_cliente
SET cliente_id = '746aed8c-67fc-435e-9e88-70991ea03097'
WHERE cliente_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';

-- 3. Migra eventuali altre entità collegate (per sicurezza)
UPDATE public.sinistri SET cliente_anagrafica_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE cliente_anagrafica_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';
UPDATE public.nominativi_cliente SET cliente_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE cliente_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';
UPDATE public.privacy_consensi SET cliente_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE cliente_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';
UPDATE public.documenti SET entita_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE entita_tipo = 'cliente' AND entita_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';
UPDATE public.trattative SET cliente_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE cliente_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';
UPDATE public.chat_canali SET entita_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE entita_tipo = 'cliente' AND entita_id = '6e60fe40-472b-4402-9206-747b6bdd71dc';

-- 4. Copia CF dal legacy al master (master non ha CF)
UPDATE public.clienti
SET codice_fiscale = COALESCE(codice_fiscale, 'LGDMCN77E41C342Y')
WHERE id = '746aed8c-67fc-435e-9e88-70991ea03097'
  AND codice_fiscale IS NULL;

-- ====== PARTE B: Schema deduplica ======

-- Aggiungi colonne tracking merge
ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE INDEX IF NOT EXISTS idx_clienti_merged_into ON public.clienti(merged_into) WHERE merged_into IS NOT NULL;

-- Tabella log merge (audit trail)
CREATE TABLE IF NOT EXISTS public.clienti_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_master_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  cliente_legacy_id uuid NOT NULL,
  snapshot_legacy jsonb NOT NULL,
  entita_spostate jsonb NOT NULL DEFAULT '{}'::jsonb,
  eseguito_da uuid,
  eseguito_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.clienti_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/responsabile can view merge log"
ON public.clienti_merge_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'responsabile_sede')
  )
);

CREATE POLICY "Service role can insert merge log"
ON public.clienti_merge_log FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'responsabile_sede')
  )
);

-- Backfill log per il merge Lo Giudice appena fatto
INSERT INTO public.clienti_merge_log (cliente_master_id, cliente_legacy_id, snapshot_legacy, entita_spostate, note)
SELECT 
  '746aed8c-67fc-435e-9e88-70991ea03097'::uuid,
  '6e60fe40-472b-4402-9206-747b6bdd71dc'::uuid,
  to_jsonb(c.*),
  '{"titoli": 3, "codici_commerciali": 2}'::jsonb,
  'Merge manuale Lo Giudice Emilia Concetta - record legacy con nome mal-splittato'
FROM public.clienti c
WHERE c.id = '6e60fe40-472b-4402-9206-747b6bdd71dc';

-- Disattiva e marca come merged il legacy Lo Giudice
UPDATE public.clienti
SET attivo = false,
    merged_into = '746aed8c-67fc-435e-9e88-70991ea03097',
    merged_at = now(),
    note = COALESCE(note,'') || ' [MERGED in 746aed8c il ' || to_char(now(),'YYYY-MM-DD') || ']'
WHERE id = '6e60fe40-472b-4402-9206-747b6bdd71dc';

-- ====== RPC: Trova duplicati ======
CREATE OR REPLACE FUNCTION public.find_clienti_duplicati()
RETURNS TABLE(
  cluster_key text,
  match_type text,
  confidenza text,
  cliente_id uuid,
  nome_completo text,
  codice_fiscale text,
  partita_iva text,
  tipo_cliente text,
  attivo boolean,
  merged_into uuid,
  num_polizze bigint,
  num_sinistri bigint,
  num_documenti bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT 
      c.id, c.nome, c.cognome, c.ragione_sociale, c.codice_fiscale, 
      c.partita_iva, c.tipo_cliente, c.attivo, c.merged_into, c.created_at,
      TRIM(BOTH ' ' FROM UPPER(REGEXP_REPLACE(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'') || ' ' || COALESCE(c.ragione_sociale,''), '\s+', ' ', 'g'))) AS nome_norm
    FROM public.clienti c
    WHERE c.merged_into IS NULL
  ),
  -- Cluster per CF
  by_cf AS (
    SELECT UPPER(TRIM(codice_fiscale)) AS k, 'codice_fiscale' AS mt, 'alta' AS conf
    FROM base WHERE codice_fiscale IS NOT NULL AND TRIM(codice_fiscale) <> ''
    GROUP BY UPPER(TRIM(codice_fiscale)) HAVING COUNT(*) > 1
  ),
  -- Cluster per PIVA
  by_piva AS (
    SELECT TRIM(partita_iva) AS k, 'partita_iva' AS mt, 'alta' AS conf
    FROM base WHERE partita_iva IS NOT NULL AND TRIM(partita_iva) <> ''
    GROUP BY TRIM(partita_iva) HAVING COUNT(*) > 1
  ),
  -- Cluster per nome+cognome senza CF
  by_name AS (
    SELECT nome_norm AS k, 'nome_cognome' AS mt, 'media' AS conf
    FROM base 
    WHERE (codice_fiscale IS NULL OR TRIM(codice_fiscale) = '')
      AND nome_norm <> '' AND LENGTH(nome_norm) > 3
    GROUP BY nome_norm HAVING COUNT(*) > 1
  ),
  matched AS (
    SELECT b.id, 'CF:' || cf.k AS cluster_key, cf.mt, cf.conf
    FROM base b JOIN by_cf cf ON UPPER(TRIM(b.codice_fiscale)) = cf.k
    UNION ALL
    SELECT b.id, 'PIVA:' || pv.k, pv.mt, pv.conf
    FROM base b JOIN by_piva pv ON TRIM(b.partita_iva) = pv.k
    UNION ALL
    SELECT b.id, 'NAME:' || nm.k, nm.mt, nm.conf
    FROM base b JOIN by_name nm ON b.nome_norm = nm.k
    WHERE (b.codice_fiscale IS NULL OR TRIM(b.codice_fiscale) = '')
  )
  SELECT 
    m.cluster_key,
    m.mt,
    m.conf,
    c.id,
    TRIM(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'') || ' ' || COALESCE(c.ragione_sociale,''))::text,
    c.codice_fiscale,
    c.partita_iva,
    c.tipo_cliente,
    c.attivo,
    c.merged_into,
    (SELECT COUNT(*) FROM titoli t WHERE t.cliente_anagrafica_id = c.id),
    (SELECT COUNT(*) FROM sinistri s WHERE s.cliente_anagrafica_id = c.id),
    (SELECT COUNT(*) FROM documenti d WHERE d.entita_tipo = 'cliente' AND d.entita_id = c.id),
    c.created_at
  FROM matched m
  JOIN public.clienti c ON c.id = m.id
  ORDER BY m.cluster_key, c.created_at;
$$;

-- ====== RPC: Esegui merge atomico ======
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
  -- Verifica ruolo
  SELECT ruolo INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin','responsabile_sede') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin o responsabile_sede';
  END IF;

  IF _master_id = _legacy_id THEN
    RAISE EXCEPTION 'Master e legacy non possono coincidere';
  END IF;

  -- Snapshot del legacy
  SELECT to_jsonb(c.*) INTO v_snapshot FROM public.clienti c WHERE c.id = _legacy_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Cliente legacy non trovato';
  END IF;

  -- Sposta polizze
  UPDATE public.titoli SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_titoli = ROW_COUNT;

  UPDATE public.sinistri SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_sinistri = ROW_COUNT;

  UPDATE public.documenti SET entita_id = _master_id WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id;
  GET DIAGNOSTICS v_documenti = ROW_COUNT;

  UPDATE public.trattative SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_trattative = ROW_COUNT;

  UPDATE public.codici_commerciali_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_codici = ROW_COUNT;

  UPDATE public.nominativi_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_nominativi = ROW_COUNT;

  UPDATE public.privacy_consensi SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_privacy = ROW_COUNT;

  UPDATE public.chat_canali SET entita_id = _master_id WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id;
  GET DIAGNOSTICS v_canali = ROW_COUNT;

  -- Disattiva e marca legacy
  UPDATE public.clienti
  SET attivo = false,
      merged_into = _master_id,
      merged_at = now(),
      merged_by = auth.uid(),
      note = COALESCE(note,'') || ' [MERGED in ' || _master_id::text || ' il ' || to_char(now(),'YYYY-MM-DD') || ']'
  WHERE id = _legacy_id;

  -- Salva log
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