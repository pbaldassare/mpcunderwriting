-- One-shot: Consorzio Bonifica Basso Molise — polizza 10045891000092
-- Allinea madre + quietanze Incassi al totale blocco ufficiale (€ 6184.05
-- (già presente sul quietanza-as-titolo a419f510-…).
-- Applicato in produzione via Supabase MCP il 2026-07-17; rieseguibile in sicurezza (idempotente).

BEGIN;

UPDATE public.quietanze
SET
  provvigioni_firma = 6184.05,
  provvigioni_quietanza = 6184.05,
  updated_at = now()
WHERE id = 'bcd4e6bc-f6e4-4b49-b23a-096be630e614'
  AND titolo_id = '0e12c338-9f31-4cba-9ad3-284fa1961222';

UPDATE public.titoli
SET
  provvigioni_firma = 6184.05,
  provvigioni_quietanza = 6184.05,
  updated_at = now()
WHERE id = '0e12c338-9f31-4cba-9ad3-284fa1961222'
  AND numero_titolo = '10045891000092'
  AND sostituisce_polizza IS NULL;

-- Child già a 6184.05: nessuna modifica necessaria
-- id = a419f510-8871-4ecf-9e20-102f91d470eb

COMMIT;

-- Verifica
SELECT 'madre' AS src, provvigioni_firma, provvigioni_quietanza
FROM titoli WHERE id = '0e12c338-9f31-4cba-9ad3-284fa1961222'
UNION ALL
SELECT 'child', provvigioni_firma, provvigioni_quietanza
FROM titoli WHERE id = 'a419f510-8871-4ecf-9e20-102f91d470eb'
UNION ALL
SELECT 'quietanze', provvigioni_firma, provvigioni_quietanza
FROM quietanze WHERE id = 'bcd4e6bc-f6e4-4b49-b23a-096be630e614';
