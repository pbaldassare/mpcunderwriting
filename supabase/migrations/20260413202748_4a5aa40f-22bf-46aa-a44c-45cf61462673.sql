
-- 1. Delete duplicates (Ferrante versions)
DELETE FROM titoli WHERE id = 'ae2831df-2bad-497d-9cf8-adfb30a4796b'; -- 6131402092 duplicate
DELETE FROM titoli WHERE id = '4976bf06-49d7-4027-9379-21ef555e6ba9'; -- RCM00010074404 duplicate

-- 2. Fix 332437571: ramo INFORTUNI CUMULATIVA, compagnia ASSISUD, specialist/AE/produttore/filiale/scadenza
UPDATE titoli SET
  specialist = 'GUARRACINO GAETANO',
  ae_nome = 'SEDE CATANIA',
  produttore_nome = 'INTERFIDI SRL',
  ramo_id = 'f3478e36-2d2a-4827-9a56-a059c826ce14',
  compagnia_id = '4d21f189-81b7-4548-b641-63e31942a4b3',
  filiale = 'SS',
  data_scadenza = '2026-04-04'
WHERE id = 'd046ffeb-2ed1-43cc-ba03-a07cfb838804';

-- 3. Fix 332437574: ramo R.C.T./R.C.O, compagnia ASSISUD, specialist/AE/produttore/filiale/scadenza
UPDATE titoli SET
  specialist = 'GUARRACINO GAETANO',
  ae_nome = 'SEDE CATANIA',
  produttore_nome = 'INTERFIDI SRL',
  ramo_id = '48c837bf-7775-4c64-93c5-ce170e76cb5d',
  compagnia_id = '4d21f189-81b7-4548-b641-63e31942a4b3',
  filiale = 'SS',
  data_scadenza = '2026-04-04'
WHERE id = '66c6cf18-5fc9-4a29-b593-133f2eabe70d';

-- 4. Fix AXKY13OP: ramo R.C. MOTO, specialist/AE/produttore null/filiale/scadenza
UPDATE titoli SET
  specialist = 'GUARRACINO GAETANO',
  ae_nome = 'SEDE NAPOLI',
  produttore_nome = NULL,
  ramo_id = 'e236bf65-ffd0-4048-aa0d-c0f1835c3b61',
  filiale = 'NA',
  data_scadenza = '2026-04-20'
WHERE id = 'e32fcd8f-b583-4d78-bf54-2600106d0f0d';

-- 5. Fix produttore mancante
UPDATE titoli SET produttore_nome = 'INTERFIDI SRL' WHERE id = 'd97f56e6-4ad1-4e6d-aa85-d756b1416501'; -- 332434490
UPDATE titoli SET produttore_nome = 'INTERFIDI SRL' WHERE id = '1db21814-5df2-47b3-9135-e6995fe70177'; -- 182209800
UPDATE titoli SET produttore_nome = 'INTERFIDI SRL' WHERE id = '3ce97739-5576-42b5-987b-1d9e0386e934'; -- 39526Q

-- 6. Fix provvigioni
UPDATE titoli SET provvigioni_firma = 0 WHERE id = 'd97f56e6-4ad1-4e6d-aa85-d756b1416501'; -- 332434490
UPDATE titoli SET provvigioni_firma = 12.16 WHERE id = '1db21814-5df2-47b3-9135-e6995fe70177'; -- 182209800
UPDATE titoli SET provvigioni_firma = 2553.68, provvigioni_quietanza = 1276.84 WHERE id = '074979de-381b-4775-9549-de3fbef5cf6b'; -- 9479008.
