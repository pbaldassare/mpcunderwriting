-- =============================================================================
-- Pilota ripristino dati — Ufficio Bergamo, giugno 2026
-- Progetto: zbjmnnlojxprlogbnxef (Consulnet / CBnet)
--
-- Scopo: annullare messe a cassa pilota e resettare ricongiungimento bancario
--        per ripartire con il modello madre + quietanze + MessaCassaDialog.
--
-- ⚠️ ESEGUIRE SOLO DOPO BACKUP. Nessun pulsante UI: script manuale admin.
-- ⚠️ NON toccare le polizze duplicate intenzionali (riconciliazione Apr 2026):
--    204366651, 6131402092, RCM00010074404
--
-- Stato esecuzione pilota (2026-06-29): GIÀ ESEGUITO sul remoto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Costanti pilota
-- -----------------------------------------------------------------------------
-- Ufficio Bergamo
--   d2d73996-a161-4a04-be84-260f6c514c23
-- Movimento bancario ARS RESTAURI 647€ (era ricongiunto)
--   28ffeff5-d094-4cc2-9c93-943d77b4fc47
-- Quietanze Bergamo giugno 2026 annullate:
--   22eac3e5-ad04-40a9-8b33-b827efd01df7  411299934
--   ab943282-d2d2-4a61-bb13-019407156d74  PI-9043092662
--   227006d8-6a8e-4d1f-bf03-ca0080e0264b  181784156
--   152bfd78-0670-4646-b3bc-0017e9493392  114601594 (riga 2 — incasso errato)

-- -----------------------------------------------------------------------------
-- 1) INVENTARIO (solo lettura)
-- -----------------------------------------------------------------------------

-- A) Madri ancora incassate (errore strutturale — target: 0)
SELECT id, numero_titolo, stato, data_messa_cassa, data_incasso, ufficio_id
FROM public.titoli
WHERE sostituisce_polizza IS NULL
  AND (data_messa_cassa IS NOT NULL OR stato = 'incassato')
  AND numero_titolo NOT IN ('204366651', '6131402092', 'RCM00010074404')
ORDER BY data_messa_cassa DESC NULLS LAST;

-- B) Madri attive senza alcuna rata figlia (~40 al 2026-06-29)
SELECT COUNT(*) AS madri_senza_rate
FROM public.titoli m
WHERE m.sostituisce_polizza IS NULL
  AND m.stato NOT IN ('annullato')
  AND m.numero_titolo NOT IN ('204366651', '6131402092', 'RCM00010074404')
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli q
    WHERE q.numero_titolo = m.numero_titolo
      AND q.sostituisce_polizza IS NOT NULL
  );

-- C) quietanze tabella fuori sync con titoli (~10 al 2026-06-29)
SELECT q.titolo_id, t.numero_titolo, q.stato AS q_stato, t.stato AS t_stato,
       q.data_messa_cassa AS q_mc, t.data_messa_cassa AS t_mc
FROM public.quietanze q
JOIN public.titoli t ON t.id = q.titolo_id
WHERE q.stato IS DISTINCT FROM CASE t.stato
  WHEN 'incassato' THEN 'incassato'::quietanza_stato
  WHEN 'sospeso' THEN 'sospesa'::quietanza_stato
  WHEN 'annullato' THEN 'annullata'::quietanza_stato
  ELSE 'da_incassare'::quietanza_stato
END;

-- D) Movimenti bancari per stato
SELECT stato, COUNT(*) AS n
FROM public.movimenti_bancari
GROUP BY stato
ORDER BY n DESC;

-- E) Incassi Bergamo giugno 2026 (post-pilota atteso: 0)
SELECT t.id, t.numero_titolo, t.stato, t.data_messa_cassa, t.premio_lordo
FROM public.titoli t
WHERE t.stato = 'incassato'
  AND t.data_messa_cassa >= '2026-06-01'
  AND t.data_messa_cassa < '2026-07-01'
  AND t.ufficio_id = 'd2d73996-a161-4a04-be84-260f6c514c23';

-- F) Anomalie duplicate rate (es. 114601594 — 3 titoli stesso numero)
SELECT id, numero_titolo, sostituisce_polizza, riga, stato, data_messa_cassa, created_at
FROM public.titoli
WHERE numero_titolo = '114601594'
ORDER BY riga NULLS FIRST, created_at;

-- G) Blocchi annullo per titolo (provvigioni pagate / rimessa non bozza)
SELECT t.id, t.numero_titolo,
  EXISTS(SELECT 1 FROM provvigioni_generate pg WHERE pg.titolo_id = t.id AND pg.pagata) AS prov_pagate,
  EXISTS(
    SELECT 1 FROM rimessa_dettaglio rd
    JOIN rimessa_premi rp ON rp.id = rd.rimessa_id
    WHERE rd.titolo_id = t.id AND rp.stato NOT IN ('bozza', 'annullata')
  ) AS rimessa_bloccata
FROM public.titoli t
WHERE t.id IN (
  '22eac3e5-ad04-40a9-8b33-b827efd01df7',
  'ab943282-d2d2-4a61-bb13-019407156d74',
  '227006d8-6a8e-4d1f-bf03-ca0080e0264b',
  '152bfd78-0670-4646-b3bc-0017e9493392'
);

-- -----------------------------------------------------------------------------
-- 2) PILOTA — Annulla messa a cassa (quietanze Bergamo giugno 2026)
--    RPC: public.annulla_quietanza_incasso(uuid)
--    Ordine: dalla rata più recente alla più vecchia.
--    ✅ Già eseguito 2026-06-29 — commentato per idempotenza.
-- -----------------------------------------------------------------------------

-- SELECT public.annulla_quietanza_incasso('152bfd78-0670-4646-b3bc-0017e9493392'::uuid); -- 114601594 riga 2
-- SELECT public.annulla_quietanza_incasso('ab943282-d2d2-4a61-bb13-019407156d74'::uuid); -- PI-9043092662
-- SELECT public.annulla_quietanza_incasso('227006d8-6a8e-4d1f-bf03-ca0080e0264b'::uuid); -- 181784156
-- SELECT public.annulla_quietanza_incasso('22eac3e5-ad04-40a9-8b33-b827efd01df7'::uuid); -- 411299934

-- Nota 114601594: il ricongiungimento era su riga 1 (ec3dda32) ma l'incasso era su riga 2
-- (152bfd78). Dopo annullo tutte e 3 le righe sono attive. Per il re-test usare riga 1
-- oppure consolidare/eliminare la riga 2 duplicata prima di messa a cassa.

-- -----------------------------------------------------------------------------
-- 3) PILOTA — Reset ricongiungimento bancario (movimento ARS RESTAURI)
--    ✅ Già eseguito 2026-06-29 — commentato per idempotenza.
-- -----------------------------------------------------------------------------

-- BEGIN;
-- DELETE FROM public.movimenti_clienti
-- WHERE movimento_id = '28ffeff5-d094-4cc2-9c93-943d77b4fc47';
--
-- DELETE FROM public.movimenti_contabili
-- WHERE riferimento_tipo = 'movimento_bancario'
--   AND riferimento_id = '28ffeff5-d094-4cc2-9c93-943d77b4fc47'
--   AND categoria = 'ammanco_ricongiungimento';
--
-- DELETE FROM public.cliente_anticipi_utilizzi
-- WHERE anticipo_id IN (
--   SELECT id FROM public.cliente_anticipi
--   WHERE movimento_bancario_id = '28ffeff5-d094-4cc2-9c93-943d77b4fc47'
-- );
-- DELETE FROM public.cliente_anticipi
-- WHERE movimento_bancario_id = '28ffeff5-d094-4cc2-9c93-943d77b4fc47';
--
-- UPDATE public.movimenti_bancari
-- SET stato = 'assegnato', updated_at = now()
-- WHERE id = '28ffeff5-d094-4cc2-9c93-943d77b4fc47';
-- COMMIT;

-- -----------------------------------------------------------------------------
-- 4) VERIFICA POST-PILOTA (atteso dopo esecuzione)
-- -----------------------------------------------------------------------------
-- Bergamo incassati giugno 2026 = 0
-- movimenti_bancari: 107 assegnati, 0 ricongiunti, 0 incassati
-- Avvisi di incasso giugno 2026: 4 titoli in meno (solo altre sedi)

-- -----------------------------------------------------------------------------
-- 5) ESTENSIONE PORTAFOGLIO INTERO (template — NON eseguire in blocco senza review)
-- -----------------------------------------------------------------------------

-- 5a) Elenco tutte le quietanze incassate da annullare (escludi duplicate intenzionali)
/*
SELECT t.id, t.numero_titolo, t.data_messa_cassa, t.ufficio_id
FROM public.titoli t
WHERE t.sostituisce_polizza IS NOT NULL
  AND (t.stato = 'incassato' OR t.data_messa_cassa IS NOT NULL)
  AND t.numero_titolo NOT IN ('204366651', '6131402092', 'RCM00010074404')
  AND NOT EXISTS (
    SELECT 1 FROM public.provvigioni_generate pg
    WHERE pg.titolo_id = t.id AND pg.pagata = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.rimessa_dettaglio rd
    JOIN public.rimessa_premi rp ON rp.id = rd.rimessa_id
    WHERE rd.titolo_id = t.id AND rp.stato NOT IN ('bozza', 'annullata')
  )
ORDER BY t.data_messa_cassa DESC;
*/

-- 5b) Loop annullo (eseguire titolo per titolo, non in un unico DO senza log)
-- SELECT public.annulla_quietanza_incasso('<titolo_uuid>'::uuid);

-- 5c) Madre legacy incassata (es. 440299956 Napoli) — caso speciale
-- Spostare incasso su rata 1 o annullare madre dopo creazione rate:
/*
SELECT id, numero_titolo, sostituisce_polizza, riga, stato, data_messa_cassa
FROM public.titoli WHERE numero_titolo = '440299956' ORDER BY riga NULLS FIRST;
*/

-- 5d) Reset tutti i movimenti ricongiunti/incassati (solo dopo annullo incassi collegati)
/*
BEGIN;
DELETE FROM public.movimenti_clienti mc
USING public.movimenti_bancari mb
WHERE mc.movimento_id = mb.id AND mb.stato IN ('ricongiunti', 'incassato');

DELETE FROM public.movimenti_contabili
WHERE riferimento_tipo = 'movimento_bancario'
  AND categoria = 'ammanco_ricongiungimento';

DELETE FROM public.cliente_anticipi_utilizzi u
USING public.cliente_anticipi a
WHERE u.anticipo_id = a.id AND a.movimento_bancario_id IS NOT NULL;

DELETE FROM public.cliente_anticipi WHERE movimento_bancario_id IS NOT NULL;

UPDATE public.movimenti_bancari
SET stato = 'assegnato', updated_at = now()
WHERE stato IN ('ricongiunti', 'incassato');
COMMIT;
*/

-- 5e) Riparazione madri senza rate — richiede script dedicato (clone da backfill
--     migration 20260618122523) — non automatizzare senza review per polizza.
