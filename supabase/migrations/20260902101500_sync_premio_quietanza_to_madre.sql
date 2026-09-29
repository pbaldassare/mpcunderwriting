-- Quando si salvano i premi su una quietanza, copia importi/provvigioni sulla polizza madre
-- (liste cliente/portafoglio usano titoli.premio_lordo della madre).

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

  -- Quietanza (non appendice): allinea la riga polizza madre agli importi appena salvati.
  UPDATE public.titoli m
  SET
    premio_lordo = q.premio_lordo,
    premio_netto = q.premio_netto,
    addizionali = q.addizionali,
    tasse = q.tasse,
    ssn_firma = q.ssn_firma,
    premio_netto_quietanza = q.premio_netto_quietanza,
    addizionali_quietanza = q.addizionali_quietanza,
    tasse_quietanza = q.tasse_quietanza,
    ssn_quietanza = q.ssn_quietanza,
    provvigioni_firma = q.provvigioni_firma,
    provvigioni_quietanza = q.provvigioni_quietanza,
    updated_at = now()
  FROM public.titoli q
  WHERE q.id = p_titolo_id
    AND q.sostituisce_polizza IS NOT NULL
    AND COALESCE(q.is_appendice_modifica, false) = false
    AND COALESCE(q.is_proroga, false) = false
    AND COALESCE(q.is_regolazione, false) = false
    AND m.sostituisce_polizza IS NULL
    AND COALESCE(m.is_appendice_modifica, false) = false
    AND COALESCE(m.is_proroga, false) = false
    AND COALESCE(m.is_regolazione, false) = false
    AND m.numero_titolo = q.numero_titolo;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.salva_premi_garanzia_titolo(uuid, text, jsonb, jsonb) IS
  'Salva righe premi_garanzia_polizza e totali titolo. Se il titolo è una quietanza, copia gli importi sulla polizza madre.';

-- Allinea madri già divergenti: quietanza stesso periodo (o prima rata).
UPDATE public.titoli m
SET
  premio_lordo = q.premio_lordo,
  premio_netto = q.premio_netto,
  addizionali = q.addizionali,
  tasse = q.tasse,
  ssn_firma = q.ssn_firma,
  premio_netto_quietanza = q.premio_netto_quietanza,
  addizionali_quietanza = q.addizionali_quietanza,
  tasse_quietanza = q.tasse_quietanza,
  ssn_quietanza = q.ssn_quietanza,
  provvigioni_firma = q.provvigioni_firma,
  provvigioni_quietanza = q.provvigioni_quietanza,
  updated_at = now()
FROM public.titoli q
WHERE m.sostituisce_polizza IS NULL
  AND COALESCE(m.is_appendice_modifica, false) = false
  AND COALESCE(m.is_proroga, false) = false
  AND COALESCE(m.is_regolazione, false) = false
  AND q.id = (
    SELECT t.id
    FROM public.titoli t
    WHERE t.numero_titolo = m.numero_titolo
      AND t.sostituisce_polizza IS NOT NULL
      AND COALESCE(t.is_appendice_modifica, false) = false
      AND COALESCE(t.is_proroga, false) = false
      AND COALESCE(t.is_regolazione, false) = false
    ORDER BY
      CASE WHEN t.garanzia_da IS NOT DISTINCT FROM m.garanzia_da THEN 0 ELSE 1 END,
      t.riga NULLS LAST,
      t.garanzia_da NULLS LAST
    LIMIT 1
  )
  AND q.premio_lordo IS NOT NULL
  AND COALESCE(m.premio_lordo, 0) IS DISTINCT FROM COALESCE(q.premio_lordo, 0);
