
-- 1. Fix premiums and commissions for 3 imported policies
UPDATE titoli SET premio_lordo = 337, provvigioni_firma = 65.60, provvigioni_quietanza = 26.24
WHERE id = 'd046ffeb-2ed1-43cc-ba03-a07cfb838804';

UPDATE titoli SET premio_lordo = 300, provvigioni_firma = 35.33, provvigioni_quietanza = 14.13
WHERE id = '66c6cf18-5fc9-4a29-b593-133f2eabe70d';

UPDATE titoli SET premio_lordo = 243, provvigioni_firma = 20, provvigioni_quietanza = 0
WHERE id = 'e32fcd8f-b583-4d78-bf54-2600106d0f0d';

-- 2. Create missing client Lo Giudice Emilia Concetta
INSERT INTO clienti (id, cognome, nome, tipo_cliente, tipo_persona, attivo, codice_ricerca, ufficio_id)
VALUES (
  gen_random_uuid(),
  'Lo Giudice',
  'Emilia Concetta',
  'privato',
  'fisica',
  true,
  'LOGIUD',
  '327e92f7-64f0-48b9-9e48-73611d8cb406'
);

-- 3. Insert policy RCM00010074404 (AmTrust, RC Professionale)
INSERT INTO titoli (numero_titolo, stato, premio_lordo, data_scadenza, garanzia_a, rate,
  compagnia_id, ramo_id, ufficio_id, cliente_anagrafica_id,
  ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza)
VALUES (
  'RCM00010074404', 'attivo', 750, '2026-04-19', '2026-04-19', 3,
  '94e2ef15-c0d5-4350-8d27-a7d9f8ce2a68',
  '502176d5-8595-4d98-b451-67cbd4f9c3fe',
  '327e92f7-64f0-48b9-9e48-73611d8cb406',
  (SELECT id FROM clienti WHERE codice_ricerca = 'LOGIUD' LIMIT 1),
  'Ferrante', NULL, 'Ferrante', 75, 30
);

-- 4. Insert policy 6131402092 (HDI, RC Auto, Regione Campania)
INSERT INTO titoli (numero_titolo, stato, premio_lordo, data_scadenza, garanzia_a, rate,
  compagnia_id, ramo_id, ufficio_id, cliente_anagrafica_id,
  ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza)
VALUES (
  '6131402092', 'attivo', 63050.22, '2026-04-30', '2026-04-30', 1,
  'ea6395c3-d672-4f10-b6d4-4246bb61fbd1',
  '3475af3c-90ab-43bf-9258-840bed242db2',
  '327e92f7-64f0-48b9-9e48-73611d8cb406',
  'fe446bf7-7abc-4dbb-9199-4435b14ef37c',
  'Ferrante', NULL, 'Ferrante', 0, 0
);
