
-- 1. Aggiorna la funzione di sync per copiare TUTTI i campi della riga
CREATE OR REPLACE FUNCTION public.sync_quietanza_da_firma(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step A: ricollega Quietanze "orfane" (senza voce_origine_id) a Firme con stesso codice/ordine
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

  -- Step B: rimuovi Quietanze non personalizzate orfane (nessuna Firma corrispondente)
  DELETE FROM public.premi_garanzia_polizza q
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND (q.voce_origine_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.premi_garanzia_polizza f
                        WHERE f.id = q.voce_origine_id AND f.tipo_premio = 'firma'));

  -- Step C: rimuovi duplicati di Quietanza con stesso codice_garanzia (mantieni la collegata, poi la personalizzata, poi la più recente)
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

  -- Step D: inserisci Quietanze mancanti per ogni Firma (copiando TUTTI i campi)
  INSERT INTO public.premi_garanzia_polizza (
    titolo_id, garanzia, codice_garanzia, firma, aliquota_tasse_pct,
    is_rca_principale, imposta_provinciale, ssn, lordo_calcolato, ordine,
    capitale, tasso, rata, annuo,
    tipo_premio, voce_origine_id, quietanza_personalizzata
  )
  SELECT
    f.titolo_id, f.garanzia, f.codice_garanzia, f.firma, f.aliquota_tasse_pct,
    f.is_rca_principale, f.imposta_provinciale, f.ssn, f.lordo_calcolato, f.ordine,
    f.capitale, f.tasso, f.rata, f.annuo,
    'quietanza', f.id, false
  FROM public.premi_garanzia_polizza f
  WHERE f.titolo_id = p_titolo_id
    AND f.tipo_premio = 'firma'
    AND NOT EXISTS (
      SELECT 1 FROM public.premi_garanzia_polizza q
      WHERE q.tipo_premio = 'quietanza' AND q.voce_origine_id = f.id
    );

  -- Step E: aggiorna le Quietanze NON personalizzate con TUTTI i campi della Firma corrispondente
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
      annuo = f.annuo
  FROM public.premi_garanzia_polizza f
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND q.voce_origine_id = f.id
    AND f.tipo_premio = 'firma';
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_quietanza_da_firma(uuid) TO authenticated, service_role;

-- 2. Riallinea TUTTE le polizze esistenti
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT titolo_id FROM public.premi_garanzia_polizza WHERE tipo_premio = 'firma'
  LOOP
    PERFORM public.sync_quietanza_da_firma(r.titolo_id);
  END LOOP;
END $$;
