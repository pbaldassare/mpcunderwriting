WITH madri AS (
  SELECT numero_titolo, riga, ssn_firma, ssn_quietanza
  FROM public.titoli
  WHERE sostituisce_polizza IS NULL
)
UPDATE public.titoli t
SET ssn_firma = COALESCE(NULLIF(t.ssn_firma,0), m.ssn_quietanza, m.ssn_firma, 0),
    ssn_quietanza = COALESCE(NULLIF(t.ssn_quietanza,0), m.ssn_quietanza, m.ssn_firma, 0)
FROM madri m
WHERE t.sostituisce_polizza = m.numero_titolo
  AND (t.sostituisce_riga IS NOT DISTINCT FROM m.riga)
  AND t.data_messa_cassa IS NULL
  AND t.stato <> 'stornato'
  AND COALESCE(t.ssn_firma,0) = 0
  AND COALESCE(m.ssn_quietanza, m.ssn_firma, 0) > 0;

UPDATE public.titoli
SET premio_lordo = ROUND(
  (COALESCE(premio_netto,0) + COALESCE(tasse,0) + COALESCE(ssn_firma,0) + COALESCE(addizionali,0))::numeric
, 2)
WHERE sostituisce_polizza IS NOT NULL
  AND data_messa_cassa IS NULL
  AND stato <> 'stornato'
  AND ABS(COALESCE(premio_lordo,0) - (COALESCE(premio_netto,0)+COALESCE(tasse,0)+COALESCE(ssn_firma,0)+COALESCE(addizionali,0))) > 0.01;