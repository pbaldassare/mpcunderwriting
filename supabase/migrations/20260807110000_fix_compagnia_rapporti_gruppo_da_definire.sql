-- Data fix: collegare rapporti con gruppo "Da definire" al gruppo reale dell'agenzia.
-- Idempotente: aggiorna solo dove il rapporto è ancora su "Da definire" e l'agenzia ha un gruppo valido.
--
-- Nota trigger:
-- - trg_block_self_referential_rapporto consente lo stesso gruppo dell'agenzia solo se is_principale.
-- - trg_rapporto_principale_sync_compagnia, all'UPDATE di un rapporto principale, riscrive
--   l'anagrafica compagnia dai campi del rapporto: quindi prima di impostare is_principale
--   bisogna allineare nome/sede/iban/conto del rapporto ai dati agenzia (altrimenti li azzera).

-- 1) Preferisci FK agenzia (compagnie.gruppo_compagnia_id)
UPDATE compagnia_rapporti cr
SET
  nome_rapporto = c.nome,
  sede_denominazione = COALESCE(NULLIF(trim(cr.sede_denominazione), ''), c.nome_sede, c.nome),
  sede_indirizzo = COALESCE(NULLIF(trim(cr.sede_indirizzo), ''), c.indirizzo),
  sede_cap = COALESCE(NULLIF(trim(cr.sede_cap), ''), c.cap),
  sede_citta = COALESCE(NULLIF(trim(cr.sede_citta), ''), c.comune),
  sede_provincia = COALESCE(NULLIF(trim(cr.sede_provincia), ''), c.provincia),
  iban_dedicato = COALESCE(NULLIF(trim(cr.iban_dedicato), ''), c.iban),
  conto_bancario_id = COALESCE(cr.conto_bancario_id, c.conto_bancario_id),
  gruppo_compagnia_id = c.gruppo_compagnia_id,
  is_principale = true,
  updated_at = now()
FROM compagnie c
WHERE cr.compagnia_id = c.id
  AND cr.gruppo_compagnia_id IS DISTINCT FROM c.gruppo_compagnia_id
  AND c.gruppo_compagnia_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM gruppi_compagnia g_old
    WHERE g_old.id = cr.gruppo_compagnia_id
      AND g_old.descrizione ILIKE 'Da definire'
  )
  AND EXISTS (
    SELECT 1 FROM gruppi_compagnia g_new
    WHERE g_new.id = c.gruppo_compagnia_id
      AND g_new.descrizione NOT ILIKE 'Da definire'
  )
  AND NOT EXISTS (
    SELECT 1 FROM compagnia_rapporti cr2
    WHERE cr2.compagnia_id = cr.compagnia_id
      AND cr2.id <> cr.id
      AND cr2.is_principale = true
  );

-- 2) Fallback: agenzia con testo gruppo_compagnia ma FK null (o ancora Da definire), match per descrizione
UPDATE compagnia_rapporti cr
SET
  nome_rapporto = c.nome,
  sede_denominazione = COALESCE(NULLIF(trim(cr.sede_denominazione), ''), c.nome_sede, c.nome),
  sede_indirizzo = COALESCE(NULLIF(trim(cr.sede_indirizzo), ''), c.indirizzo),
  sede_cap = COALESCE(NULLIF(trim(cr.sede_cap), ''), c.cap),
  sede_citta = COALESCE(NULLIF(trim(cr.sede_citta), ''), c.comune),
  sede_provincia = COALESCE(NULLIF(trim(cr.sede_provincia), ''), c.provincia),
  iban_dedicato = COALESCE(NULLIF(trim(cr.iban_dedicato), ''), c.iban),
  conto_bancario_id = COALESCE(cr.conto_bancario_id, c.conto_bancario_id),
  gruppo_compagnia_id = g_match.id,
  is_principale = true,
  updated_at = now()
FROM compagnie c
JOIN gruppi_compagnia g_match
  ON lower(trim(g_match.descrizione)) = lower(trim(c.gruppo_compagnia))
 AND g_match.descrizione NOT ILIKE 'Da definire'
WHERE cr.compagnia_id = c.id
  AND nullif(trim(c.gruppo_compagnia), '') IS NOT NULL
  AND cr.gruppo_compagnia_id IS DISTINCT FROM g_match.id
  AND EXISTS (
    SELECT 1 FROM gruppi_compagnia g_old
    WHERE g_old.id = cr.gruppo_compagnia_id
      AND g_old.descrizione ILIKE 'Da definire'
  )
  AND (
    c.gruppo_compagnia_id IS NULL
    OR EXISTS (
      SELECT 1 FROM gruppi_compagnia ga
      WHERE ga.id = c.gruppo_compagnia_id
        AND ga.descrizione ILIKE 'Da definire'
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM compagnia_rapporti cr2
    WHERE cr2.compagnia_id = cr.compagnia_id
      AND cr2.id <> cr.id
      AND cr2.is_principale = true
  );
