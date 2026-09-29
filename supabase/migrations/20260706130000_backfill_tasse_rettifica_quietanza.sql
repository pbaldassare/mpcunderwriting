-- Backfill: propaga tasse_rettifica Firma → Quietanza e riallinea premio_lordo su titoli
-- Bug: mirror/sync azzerava tasse_rettifica sulla quietanza → premio_lordo -0,01 €

-- ---------------------------------------------------------------------------
-- 1) sync_quietanza_da_firma: copia anche accessori e tasse_rettifica
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
    tipo_premio, voce_origine_id, quietanza_personalizzata
  )
  SELECT
    f.titolo_id, f.garanzia, f.codice_garanzia, f.firma, f.aliquota_tasse_pct,
    f.is_rca_principale, f.imposta_provinciale, f.ssn, f.lordo_calcolato, f.ordine,
    f.capitale, f.tasso, f.rata, f.annuo, f.accessori, f.tasse_rettifica,
    f.provvigione_netto_pct, f.provvigione_accessori_pct,
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
      provvigione_accessori_pct = f.provvigione_accessori_pct
  FROM public.premi_garanzia_polizza f
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND q.voce_origine_id = f.id
    AND f.tipo_premio = 'firma';
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_quietanza_da_firma(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Helper: lordo riga premi_garanzia_polizza (allineato al frontend)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_lordo_riga_premio_garanzia(
  p_tipo_premio text,
  p_firma numeric,
  p_rata numeric,
  p_accessori numeric,
  p_ssn numeric,
  p_aliquota_tasse_pct numeric,
  p_tasse_rettifica numeric,
  p_diritti_agenzia boolean DEFAULT false
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ROUND(
    CASE
      WHEN p_diritti_agenzia THEN
        COALESCE(NULLIF(p_rata, 0), p_firma, 0)
      ELSE
        COALESCE(
          CASE WHEN p_tipo_premio = 'quietanza' THEN COALESCE(p_rata, 0) ELSE COALESCE(p_firma, 0) END,
          0
        )
        + COALESCE(p_accessori, 0)
        + CASE
            WHEN COALESCE(p_aliquota_tasse_pct, 0) > 0
              AND (
                COALESCE(
                  CASE WHEN p_tipo_premio = 'quietanza' THEN COALESCE(p_rata, 0) ELSE COALESCE(p_firma, 0) END,
                  0
                ) > 0
                OR COALESCE(p_accessori, 0) > 0
              )
            THEN ROUND(
              (
                COALESCE(
                  CASE WHEN p_tipo_premio = 'quietanza' THEN COALESCE(p_rata, 0) ELSE COALESCE(p_firma, 0) END,
                  0
                ) + COALESCE(p_accessori, 0)
              ) * p_aliquota_tasse_pct / 100,
              2
            )
            ELSE 0
          END
        + COALESCE(p_tasse_rettifica, 0)
        + COALESCE(p_ssn, 0)
    END::numeric,
    2
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Propaga tasse_rettifica mancante su righe quietanza non personalizzate
-- ---------------------------------------------------------------------------
UPDATE public.premi_garanzia_polizza q
SET tasse_rettifica = f.tasse_rettifica,
    voce_origine_id = COALESCE(q.voce_origine_id, f.id)
FROM public.premi_garanzia_polizza f
WHERE q.titolo_id = f.titolo_id
  AND q.tipo_premio = 'quietanza'
  AND f.tipo_premio = 'firma'
  AND COALESCE(q.quietanza_personalizzata, false) = false
  AND (
    q.voce_origine_id = f.id
    OR (
      q.voce_origine_id IS NULL
      AND f.ordine = q.ordine
      AND COALESCE(UPPER(f.codice_garanzia), '') = COALESCE(UPPER(q.codice_garanzia), '')
    )
  )
  AND COALESCE(q.tasse_rettifica, 0) IS DISTINCT FROM COALESCE(f.tasse_rettifica, 0);

-- Riallinea voce_origine_id mancanti (stesso titolo/codice/ordine)
UPDATE public.premi_garanzia_polizza q
SET voce_origine_id = f.id
FROM public.premi_garanzia_polizza f
WHERE q.titolo_id = f.titolo_id
  AND q.tipo_premio = 'quietanza'
  AND f.tipo_premio = 'firma'
  AND COALESCE(q.quietanza_personalizzata, false) = false
  AND q.voce_origine_id IS NULL
  AND f.ordine = q.ordine
  AND COALESCE(UPPER(f.codice_garanzia), '') = COALESCE(UPPER(q.codice_garanzia), '');

-- Sync DB trigger path (copia anche tasse_rettifica su righe non personalizzate)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT titolo_id
    FROM public.premi_garanzia_polizza
    WHERE tipo_premio = 'firma'
      AND COALESCE(tasse_rettifica, 0) <> 0
  LOOP
    PERFORM public.sync_quietanza_da_firma(r.titolo_id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Riallinea aggregati titoli da righe quietanza (o firma se assente)
-- ---------------------------------------------------------------------------
WITH titoli_con_rettifica AS (
  SELECT DISTINCT f.titolo_id
  FROM public.premi_garanzia_polizza f
  WHERE f.tipo_premio = 'firma'
    AND COALESCE(f.tasse_rettifica, 0) <> 0
),
source_tipo AS (
  SELECT
    tcr.titolo_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.premi_garanzia_polizza q
        WHERE q.titolo_id = tcr.titolo_id
          AND q.tipo_premio = 'quietanza'
      ) THEN 'quietanza'
      ELSE 'firma'
    END AS tipo_usato
  FROM titoli_con_rettifica tcr
),
row_parts AS (
  SELECT
    pg.titolo_id,
    st.tipo_usato,
    CASE
      WHEN COALESCE(r.diritti_agenzia, false) THEN 0
      ELSE CASE WHEN st.tipo_usato = 'quietanza' THEN COALESCE(pg.rata, 0) ELSE COALESCE(pg.firma, 0) END
    END AS netto,
    CASE WHEN COALESCE(r.diritti_agenzia, false) THEN 0 ELSE COALESCE(pg.accessori, 0) END AS accessori,
    CASE WHEN COALESCE(r.diritti_agenzia, false) THEN 0 ELSE COALESCE(pg.ssn, 0) END AS ssn,
    public.calc_lordo_riga_premio_garanzia(
      st.tipo_usato,
      pg.firma,
      pg.rata,
      pg.accessori,
      pg.ssn,
      pg.aliquota_tasse_pct,
      pg.tasse_rettifica,
      COALESCE(r.diritti_agenzia, false)
    ) AS lordo_riga,
    CASE
      WHEN COALESCE(r.diritti_agenzia, false) THEN
        COALESCE(NULLIF(pg.rata, 0), pg.firma, 0)
      ELSE
        CASE
          WHEN COALESCE(pg.aliquota_tasse_pct, 0) > 0
            AND (
              (CASE WHEN st.tipo_usato = 'quietanza' THEN COALESCE(pg.rata, 0) ELSE COALESCE(pg.firma, 0) END) > 0
              OR COALESCE(pg.accessori, 0) > 0
            )
          THEN ROUND(
            (
              (CASE WHEN st.tipo_usato = 'quietanza' THEN COALESCE(pg.rata, 0) ELSE COALESCE(pg.firma, 0) END)
              + COALESCE(pg.accessori, 0)
            ) * pg.aliquota_tasse_pct / 100,
            2
          )
          ELSE 0
        END
        + COALESCE(pg.tasse_rettifica, 0)
    END AS tasse_eff
  FROM public.premi_garanzia_polizza pg
  JOIN source_tipo st ON st.titolo_id = pg.titolo_id AND pg.tipo_premio = st.tipo_usato
  LEFT JOIN public.rami r
    ON UPPER(r.codice) = UPPER(pg.codice_garanzia)
   AND r.attivo = true
),
aggregati AS (
  SELECT
    titolo_id,
    tipo_usato,
    ROUND(SUM(netto), 2) AS tot_netto,
    ROUND(SUM(accessori), 2) AS tot_accessori,
    ROUND(SUM(ssn), 2) AS tot_ssn,
    ROUND(SUM(tasse_eff), 2) AS tot_tasse,
    ROUND(SUM(lordo_riga), 2) AS premio_lordo_calc
  FROM row_parts
  GROUP BY titolo_id, tipo_usato
)
UPDATE public.titoli t
SET
  premio_lordo = a.premio_lordo_calc,
  premio_netto_quietanza = CASE WHEN a.tipo_usato = 'quietanza' THEN a.tot_netto ELSE t.premio_netto_quietanza END,
  addizionali_quietanza = CASE WHEN a.tipo_usato = 'quietanza' THEN a.tot_accessori ELSE t.addizionali_quietanza END,
  tasse_quietanza = CASE WHEN a.tipo_usato = 'quietanza' THEN a.tot_tasse ELSE t.tasse_quietanza END,
  ssn_quietanza = CASE WHEN a.tipo_usato = 'quietanza' THEN a.tot_ssn ELSE t.ssn_quietanza END,
  premio_netto = CASE
    WHEN a.tipo_usato = 'quietanza' AND t.sostituisce_polizza IS NOT NULL THEN a.tot_netto
    ELSE t.premio_netto
  END,
  addizionali = CASE
    WHEN a.tipo_usato = 'quietanza' AND t.sostituisce_polizza IS NOT NULL THEN a.tot_accessori
    ELSE t.addizionali
  END,
  tasse = CASE
    WHEN a.tipo_usato = 'quietanza' AND t.sostituisce_polizza IS NOT NULL THEN a.tot_tasse
    WHEN a.tipo_usato = 'quietanza' THEN a.tot_tasse
    ELSE t.tasse
  END,
  ssn_firma = CASE
    WHEN a.tipo_usato = 'quietanza' AND t.sostituisce_polizza IS NOT NULL THEN a.tot_ssn
    ELSE t.ssn_firma
  END,
  updated_at = now()
FROM aggregati a
WHERE t.id = a.titolo_id
  AND ABS(COALESCE(t.premio_lordo, 0) - a.premio_lordo_calc) > 0.004;
