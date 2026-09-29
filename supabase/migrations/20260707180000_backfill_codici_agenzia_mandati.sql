-- ============================================================
-- Backfill codici univoci agenzie + mandati
-- Formato: AG0001 / DIR0001 / BR0001 / PL0001
-- Mandati aggiuntivi: <codiceAgenzia>-M02, -M03, ...
-- ============================================================

-- 1) Codici agenzia mancanti (il trigger propaga al rapporto principale)
WITH da_assegnare AS (
  SELECT id, tipo,
         row_number() OVER (PARTITION BY tipo ORDER BY nome, id) AS rn
  FROM public.compagnie
  WHERE codice IS NULL
    AND tipo IN ('agenzia', 'direzione', 'broker', 'plurimandataria')
),
candidati AS (
  SELECT
    d.id,
    CASE d.tipo
      WHEN 'agenzia'         THEN 'AG'
      WHEN 'direzione'       THEN 'DIR'
      WHEN 'broker'          THEN 'BR'
      WHEN 'plurimandataria' THEN 'PL'
    END || lpad(d.rn::text, 4, '0') AS nuovo_codice
  FROM da_assegnare d
)
UPDATE public.compagnie c
SET codice = cand.nuovo_codice
FROM candidati cand
WHERE c.id = cand.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.compagnie x
    WHERE lower(x.codice) = lower(cand.nuovo_codice)
  );

-- 2) Codici dei mandati aggiuntivi (non principali) mancanti
WITH mandati AS (
  SELECT
    r.id,
    c.codice AS cod_agenzia,
    row_number() OVER (PARTITION BY r.compagnia_id ORDER BY r.created_at, r.id) AS rn
  FROM public.compagnia_rapporti r
  JOIN public.compagnie c ON c.id = r.compagnia_id
  WHERE r.codice_rapporto IS NULL
    AND COALESCE(r.is_principale, false) = false
    AND c.codice IS NOT NULL
),
candidati AS (
  SELECT
    m.id,
    m.cod_agenzia || '-M' || lpad((m.rn + 1)::text, 2, '0') AS nuovo_codice
  FROM mandati m
)
UPDATE public.compagnia_rapporti r
SET codice_rapporto = cand.nuovo_codice,
    updated_at = now()
FROM candidati cand
WHERE r.id = cand.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.compagnia_rapporti x
    WHERE lower(x.codice_rapporto) = lower(cand.nuovo_codice)
  );

-- 3) Unicità globale sui codici mandato (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_compagnia_rapporti_codice_unique
  ON public.compagnia_rapporti (lower(codice_rapporto))
  WHERE codice_rapporto IS NOT NULL;
