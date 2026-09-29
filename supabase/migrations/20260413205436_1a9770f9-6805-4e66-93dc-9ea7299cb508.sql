
-- 1. Aggiornare testata titoli (durata triennale)
UPDATE titoli SET 
  durata_a = '2027-04-17',
  garanzia_da = '2026-04-17',
  anni_durata = 3
WHERE id = 'd97f56e6-4ad1-4e6d-aa85-d756b1416501';

-- 2. Inserire dati veicolo
INSERT INTO veicoli_polizza (
  titolo_id, settore, tipo_veicolo, uso, marca, modello, targa,
  veicolo_descrizione, provincia_circolazione, classe_bm,
  cv, kw, cc, posti, franchigia, peius, temporanea,
  carico_scarico, competizione, rimorchio
) VALUES (
  'd97f56e6-4ad1-4e6d-aa85-d756b1416501',
  'Autovetture', 'AUTOVETTURA', 'PRIVATO',
  'Volkswagen', 'Passat I', 'FA637ZA',
  'PASSAT TG. FA637ZA - NICOLA PIROVANO',
  'Potenza', '11',
  20, 110, 0, 5, 0, false, false,
  false, false, false
);

-- 3. Inserire dettaglio premi garanzia
INSERT INTO premi_garanzia_polizza (titolo_id, garanzia, capitale, firma, rata, annuo, ordine) VALUES
  ('d97f56e6-4ad1-4e6d-aa85-d756b1416501', 'RC', 0, 447.36, 447.36, 0, 1),
  ('d97f56e6-4ad1-4e6d-aa85-d756b1416501', 'Furto/Incendio/Eventi', 13000, 163.91, 163.91, 0, 2),
  ('d97f56e6-4ad1-4e6d-aa85-d756b1416501', 'Ass. Stradale', 0, 32.73, 32.73, 0, 3);
