-- Follow-up backfill: collegamento orfani voce_origine_id + riallinea premio_lordo

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
