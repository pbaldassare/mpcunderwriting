-- Remediation: ripristino anagrafiche compagnie accidentalmente azzerate dal sync
-- trg_rapporto_principale_sync_compagnia durante fix_compagnia_rapporti_gruppo_da_definire.
-- Usa SOLO gli eventi di danno originali (nome.new con "Da definire" / indirizzo azzerato),
-- non i successivi restore in audit. Idempotente.

-- 1) Restore da eventi originali dove il nome è stato prefissato "Da definire —"
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

-- 2) Restore anche danni senza prefisso nome (es. KRM/ASSIB) ma con indirizzo azzerato
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

-- 3) Allinea rapporti principali senza ri-triggerare wipe inverso
ALTER TABLE compagnia_rapporti DISABLE TRIGGER trg_rapporto_principale_sync_compagnia;

UPDATE compagnia_rapporti cr
SET
  nome_rapporto = c.nome,
  sede_denominazione = COALESCE(c.nome_sede, c.nome),
  sede_indirizzo = c.indirizzo,
  sede_cap = c.cap,
  sede_citta = c.comune,
  sede_provincia = c.provincia,
  conto_bancario_id = COALESCE(c.conto_bancario_id, cr.conto_bancario_id),
  iban_dedicato = COALESCE(cr.iban_dedicato, c.iban),
  updated_at = now()
FROM compagnie c
WHERE cr.compagnia_id = c.id
  AND cr.is_principale = true
  AND cr.id IN (
    '98c82a12-bb31-44ab-99ee-729a05ecf024',
    'fbc94a71-274c-43f9-afd1-f9af7dc3f2a5',
    'ba22c4e0-20d6-4f78-b9a1-f6bbd7c4f843',
    '3a2a7d4f-05cb-420a-9456-0ebac55ea7c9',
    '8ea65043-bba3-494b-ae25-af8cef7ba611',
    '200430af-4160-4c53-8bfe-0c0c099cd161',
    '65a32374-1628-4a37-b909-77987b7cb64e',
    'a6152888-3f1c-4a93-99dd-8005a8ebf282',
    'ac3ecdd4-58a1-40a9-9b94-dd8c826abe4c',
    'b782efb3-8301-4e25-8930-61aef4b3b9a1',
    '31e807be-f6be-4cc1-b560-cce29b77a240',
    '360d888d-8a57-486b-8894-e11f0b1d3c6c',
    '04d70a96-8dd9-41df-b26c-4993d89b8a3a',
    '1c9b5f17-2dbb-48cc-a8b0-4e305c580243',
    '38067ddd-0947-42b1-a794-72dc52f6a565'
  );

ALTER TABLE compagnia_rapporti ENABLE TRIGGER trg_rapporto_principale_sync_compagnia;
