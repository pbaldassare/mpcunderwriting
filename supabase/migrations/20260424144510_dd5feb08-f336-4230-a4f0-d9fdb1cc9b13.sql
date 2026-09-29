-- 1. Inserisci 16 nuovi rami sotto gruppo R.C.A. (ZQ)
INSERT INTO rami (codice, descrizione, gruppo_ramo_id, attivo)
SELECT 
  'RV' || s.codice,
  'VEICOLO - ' || UPPER(s.descrizione),
  (SELECT id FROM gruppi_ramo WHERE codice = 'ZQ'),
  true
FROM rca_settori s
ORDER BY s.codice
ON CONFLICT (codice) DO NOTHING;

-- 2. Rimuovi la FK settore_id da rca_usi
ALTER TABLE rca_usi DROP COLUMN IF EXISTS settore_id;

-- 3. Elimina la tabella rca_settori
DROP TABLE IF EXISTS rca_settori;