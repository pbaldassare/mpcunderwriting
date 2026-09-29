-- Override manuale % provvigioni per voce garanzia (netto e accessori)
-- La % di default arriva dalla matrice agenzia (provvigioni_compagnia_ramo).
-- Questi flag distinguono uno snapshot "da agenzia" da una sovrascrittura manuale
-- fatta direttamente dalla quietanza/polizza (con conferma + log attività lato UI).

ALTER TABLE public.premi_garanzia_polizza
  ADD COLUMN IF NOT EXISTS provvigione_netto_pct_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provvigione_accessori_pct_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.premi_garanzia_polizza.provvigione_netto_pct_override IS
  'True se la % provvigione netto è stata sovrascritta manualmente (non più allineata alla matrice agenzia).';
COMMENT ON COLUMN public.premi_garanzia_polizza.provvigione_accessori_pct_override IS
  'True se la % provvigione accessori è stata sovrascritta manualmente (non più allineata alla matrice agenzia).';

-- ---------------------------------------------------------------------------
-- RPC salva_premi_garanzia_titolo: aggiunge i flag override alle righe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salva_premi_garanzia_titolo(
  p_titolo_id uuid,
  p_tipo_premio text,
  p_rows jsonb,
  p_titolo_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticazione richiesta';
  END IF;

  IF p_tipo_premio NOT IN ('firma', 'quietanza') THEN
    RAISE EXCEPTION 'tipo_premio non valido: %', p_tipo_premio;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.titoli WHERE id = p_titolo_id) THEN
    RAISE EXCEPTION 'Titolo % non trovato', p_titolo_id;
  END IF;

  PERFORM id FROM public.titoli WHERE id = p_titolo_id FOR UPDATE;

  DELETE FROM public.premi_garanzia_polizza
  WHERE titolo_id = p_titolo_id
    AND tipo_premio = p_tipo_premio;

  IF p_rows IS NOT NULL AND jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO public.premi_garanzia_polizza (
      titolo_id, tipo_premio, garanzia, codice_garanzia,
      capitale, tasso, firma, rata, accessori, annuo, ordine,
      aliquota_tasse_pct, ssn, tasse_rettifica,
      provvigione_netto_pct, provvigione_accessori_pct,
      provvigione_netto_pct_override, provvigione_accessori_pct_override,
      quietanza_personalizzata
    )
    SELECT
      p_titolo_id,
      p_tipo_premio,
      COALESCE(r.garanzia, 'Premio'),
      NULLIF(r.codice_garanzia, ''),
      COALESCE(r.capitale, 0),
      COALESCE(r.tasso, 0),
      COALESCE(r.firma, 0),
      COALESCE(r.rata, 0),
      COALESCE(r.accessori, 0),
      COALESCE(r.annuo, 0),
      COALESCE(r.ordine, 0),
      r.aliquota_tasse_pct,
      COALESCE(r.ssn, 0),
      COALESCE(r.tasse_rettifica, 0),
      r.provvigione_netto_pct,
      r.provvigione_accessori_pct,
      COALESCE(r.provvigione_netto_pct_override, false),
      COALESCE(r.provvigione_accessori_pct_override, false),
      COALESCE(r.quietanza_personalizzata, false)
    FROM jsonb_to_recordset(p_rows) AS r(
      garanzia text,
      codice_garanzia text,
      capitale numeric,
      tasso numeric,
      firma numeric,
      rata numeric,
      accessori numeric,
      annuo numeric,
      ordine int,
      aliquota_tasse_pct numeric,
      ssn numeric,
      tasse_rettifica numeric,
      provvigione_netto_pct numeric,
      provvigione_accessori_pct numeric,
      provvigione_netto_pct_override boolean,
      provvigione_accessori_pct_override boolean,
      quietanza_personalizzata boolean
    );
  END IF;

  UPDATE public.titoli SET
    premio_netto = CASE WHEN p_titolo_updates ? 'premio_netto' THEN (p_titolo_updates->>'premio_netto')::numeric ELSE premio_netto END,
    addizionali = CASE WHEN p_titolo_updates ? 'addizionali' THEN (p_titolo_updates->>'addizionali')::numeric ELSE addizionali END,
    tasse = CASE WHEN p_titolo_updates ? 'tasse' THEN (p_titolo_updates->>'tasse')::numeric ELSE tasse END,
    ssn_firma = CASE WHEN p_titolo_updates ? 'ssn_firma' THEN (p_titolo_updates->>'ssn_firma')::numeric ELSE ssn_firma END,
    premio_lordo = CASE WHEN p_titolo_updates ? 'premio_lordo' THEN (p_titolo_updates->>'premio_lordo')::numeric ELSE premio_lordo END,
    provvigioni_firma = CASE WHEN p_titolo_updates ? 'provvigioni_firma' THEN (p_titolo_updates->>'provvigioni_firma')::numeric ELSE provvigioni_firma END,
    premio_netto_quietanza = CASE WHEN p_titolo_updates ? 'premio_netto_quietanza' THEN (p_titolo_updates->>'premio_netto_quietanza')::numeric ELSE premio_netto_quietanza END,
    addizionali_quietanza = CASE WHEN p_titolo_updates ? 'addizionali_quietanza' THEN (p_titolo_updates->>'addizionali_quietanza')::numeric ELSE addizionali_quietanza END,
    tasse_quietanza = CASE WHEN p_titolo_updates ? 'tasse_quietanza' THEN (p_titolo_updates->>'tasse_quietanza')::numeric ELSE tasse_quietanza END,
    ssn_quietanza = CASE WHEN p_titolo_updates ? 'ssn_quietanza' THEN (p_titolo_updates->>'ssn_quietanza')::numeric ELSE ssn_quietanza END,
    provvigioni_quietanza = CASE WHEN p_titolo_updates ? 'provvigioni_quietanza' THEN (p_titolo_updates->>'provvigioni_quietanza')::numeric ELSE provvigioni_quietanza END,
    updated_at = now()
  WHERE id = p_titolo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_quietanza_da_firma: propaga anche i flag override alle quietanze specchio
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_quietanza_da_firma(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.premi_garanzia_polizza q
  SET voce_origine_id = f.id
  FROM public.premi_garanzia_polizza f
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.voce_origine_id IS NULL
    AND f.titolo_id = p_titolo_id
    AND f.tipo_premio = 'firma'
    AND COALESCE(UPPER(f.codice_garanzia), '') = COALESCE(UPPER(q.codice_garanzia), '')
    AND f.is_rca_principale = q.is_rca_principale;

  DELETE FROM public.premi_garanzia_polizza q
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND (q.voce_origine_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.premi_garanzia_polizza f
                        WHERE f.id = q.voce_origine_id AND f.tipo_premio = 'firma'));

  DELETE FROM public.premi_garanzia_polizza q
  USING (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY titolo_id, COALESCE(UPPER(codice_garanzia), id::text), is_rca_principale
               ORDER BY (voce_origine_id IS NOT NULL) DESC,
                        quietanza_personalizzata DESC,
                        created_at DESC
             ) AS rn
      FROM public.premi_garanzia_polizza
      WHERE titolo_id = p_titolo_id AND tipo_premio = 'quietanza'
    ) t
    WHERE t.rn > 1
  ) dup
  WHERE q.id = dup.id;

  INSERT INTO public.premi_garanzia_polizza (
    titolo_id, garanzia, codice_garanzia, firma, aliquota_tasse_pct,
    is_rca_principale, imposta_provinciale, ssn, lordo_calcolato, ordine,
    capitale, tasso, rata, annuo, accessori, tasse_rettifica,
    provvigione_netto_pct, provvigione_accessori_pct,
    provvigione_netto_pct_override, provvigione_accessori_pct_override,
    tipo_premio, voce_origine_id, quietanza_personalizzata
  )
  SELECT
    f.titolo_id, f.garanzia, f.codice_garanzia, f.firma, f.aliquota_tasse_pct,
    f.is_rca_principale, f.imposta_provinciale, f.ssn, f.lordo_calcolato, f.ordine,
    f.capitale, f.tasso, f.rata, f.annuo, f.accessori, f.tasse_rettifica,
    f.provvigione_netto_pct, f.provvigione_accessori_pct,
    f.provvigione_netto_pct_override, f.provvigione_accessori_pct_override,
    'quietanza', f.id, false
  FROM public.premi_garanzia_polizza f
  WHERE f.titolo_id = p_titolo_id
    AND f.tipo_premio = 'firma'
    AND NOT EXISTS (
      SELECT 1 FROM public.premi_garanzia_polizza q
      WHERE q.tipo_premio = 'quietanza' AND q.voce_origine_id = f.id
    );

  UPDATE public.premi_garanzia_polizza q
  SET garanzia = f.garanzia,
      codice_garanzia = f.codice_garanzia,
      firma = f.firma,
      aliquota_tasse_pct = f.aliquota_tasse_pct,
      is_rca_principale = f.is_rca_principale,
      imposta_provinciale = f.imposta_provinciale,
      ssn = f.ssn,
      lordo_calcolato = f.lordo_calcolato,
      ordine = f.ordine,
      capitale = f.capitale,
      tasso = f.tasso,
      rata = f.rata,
      annuo = f.annuo,
      accessori = f.accessori,
      tasse_rettifica = f.tasse_rettifica,
      provvigione_netto_pct = f.provvigione_netto_pct,
      provvigione_accessori_pct = f.provvigione_accessori_pct,
      provvigione_netto_pct_override = f.provvigione_netto_pct_override,
      provvigione_accessori_pct_override = f.provvigione_accessori_pct_override
  FROM public.premi_garanzia_polizza f
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND q.voce_origine_id = f.id
    AND f.tipo_premio = 'firma';
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_quietanza_da_firma(uuid) TO authenticated, service_role;
