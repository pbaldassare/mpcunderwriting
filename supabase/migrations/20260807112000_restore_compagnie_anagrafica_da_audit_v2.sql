-- Corrected remediation (idempotent). Complements 20260807111000 after audit-selection fix.
-- See comments in 20260807111000_restore_compagnie_dopo_fix_gruppo_da_definire.sql

WITH damage AS (
  SELECT DISTINCT ON (entita_id)
    entita_id,
    dettagli_json->'changes' AS changes
  FROM log_attivita
  WHERE azione = 'compagnia_modificato'
    AND created_at >= '2026-08-07 08:20:00+00'
    AND created_at <= '2026-08-07 08:30:00+00'
    AND (dettagli_json->'changes'->'nome'->>'new') ILIKE 'Da definire%'
    AND (dettagli_json->'changes'->'nome'->>'old') NOT ILIKE 'Da definire%'
  ORDER BY entita_id, created_at ASC
)
UPDATE compagnie c
SET
  nome = d.changes->'nome'->>'old',
  cap = COALESCE(d.changes->'cap'->>'old', c.cap),
  comune = COALESCE(d.changes->'comune'->>'old', c.comune),
  indirizzo = COALESCE(d.changes->'indirizzo'->>'old', c.indirizzo),
  nome_sede = COALESCE(d.changes->'nome_sede'->>'old', c.nome_sede),
  provincia = COALESCE(d.changes->'provincia'->>'old', c.provincia),
  conto_bancario_id = COALESCE((d.changes->'conto_bancario_id'->>'old')::uuid, c.conto_bancario_id)
FROM damage d
WHERE c.id = d.entita_id
  AND (
    c.nome ILIKE 'Da definire%'
    OR c.indirizzo IS NULL AND (d.changes->'indirizzo'->>'old') IS NOT NULL
  );

WITH damage AS (
  SELECT DISTINCT ON (entita_id)
    entita_id,
    dettagli_json->'changes' AS changes
  FROM log_attivita
  WHERE azione = 'compagnia_modificato'
    AND created_at >= '2026-08-07 08:24:00+00'
    AND created_at <= '2026-08-07 08:25:30+00'
    AND dettagli_json->'changes' ? 'indirizzo'
    AND (dettagli_json->'changes'->'indirizzo'->>'new') IS NULL
    AND (dettagli_json->'changes'->'indirizzo'->>'old') IS NOT NULL
  ORDER BY entita_id, created_at ASC
)
UPDATE compagnie c
SET
  nome = COALESCE(d.changes->'nome'->>'old', c.nome),
  cap = COALESCE(d.changes->'cap'->>'old', c.cap),
  comune = COALESCE(d.changes->'comune'->>'old', c.comune),
  indirizzo = COALESCE(d.changes->'indirizzo'->>'old', c.indirizzo),
  nome_sede = COALESCE(d.changes->'nome_sede'->>'old', c.nome_sede),
  provincia = COALESCE(d.changes->'provincia'->>'old', c.provincia),
  conto_bancario_id = COALESCE((d.changes->'conto_bancario_id'->>'old')::uuid, c.conto_bancario_id)
FROM damage d
WHERE c.id = d.entita_id
  AND (
    c.indirizzo IS NULL
    OR c.nome ILIKE 'Da definire%'
    OR c.nome IS DISTINCT FROM (d.changes->'nome'->>'old')
  );
