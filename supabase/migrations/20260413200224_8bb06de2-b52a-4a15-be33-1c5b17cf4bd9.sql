
-- 1. Create missing client "Comune di Santa Marina Salina"
INSERT INTO clienti (id, ragione_sociale, tipo_cliente, tipo_persona, attivo, codice_ricerca, ufficio_id)
VALUES (
  gen_random_uuid(),
  'Comune di Santa Marina Salina',
  'ente',
  'giuridica',
  true,
  '002649',
  '327e92f7-64f0-48b9-9e48-73611d8cb406'
);

-- 2. Insert policy 332437571 (Generali - Incendio Civile)
INSERT INTO titoli (numero_titolo, stato, premio_lordo, data_scadenza, garanzia_a, rate,
  compagnia_id, ramo_id, ufficio_id, cliente_anagrafica_id,
  ae_nome, specialist, produttore_nome)
VALUES (
  '332437571', 'attivo', 2917.00, '2026-04-30', '2026-04-30', 1,
  'ba6ba11c-cde2-4150-9e63-452e0f602e6d',
  'dbbd0609-d604-45a5-affb-c83d2d50913e',
  '327e92f7-64f0-48b9-9e48-73611d8cb406',
  (SELECT id FROM clienti WHERE codice_ricerca = '002649' LIMIT 1),
  'Ferrante', 'La Barbera', 'Ferrante'
);

-- 3. Insert policy 332437574 (Generali - RCT)
INSERT INTO titoli (numero_titolo, stato, premio_lordo, data_scadenza, garanzia_a, rate,
  compagnia_id, ramo_id, ufficio_id, cliente_anagrafica_id,
  ae_nome, specialist, produttore_nome)
VALUES (
  '332437574', 'attivo', 4200.00, '2026-04-30', '2026-04-30', 1,
  'ba6ba11c-cde2-4150-9e63-452e0f602e6d',
  '4abd8c7e-ffb3-47f7-9b0d-925ee470f9dd',
  '327e92f7-64f0-48b9-9e48-73611d8cb406',
  (SELECT id FROM clienti WHERE codice_ricerca = '002649' LIMIT 1),
  'Ferrante', 'La Barbera', 'Ferrante'
);

-- 4. Insert policy AXKY13OP (Zurich - D&O, client Consulbrokers)
INSERT INTO titoli (numero_titolo, stato, premio_lordo, data_scadenza, garanzia_a, rate,
  compagnia_id, ramo_id, ufficio_id, cliente_anagrafica_id,
  ae_nome, specialist, produttore_nome)
VALUES (
  'AXKY13OP', 'attivo', 2190.00, '2026-04-27', '2026-04-27', 1,
  'b789d0de-cd2f-470d-8b71-0a70cf9830f6',
  '505b1d86-aa4f-4eff-9e04-42e2f665c63f',
  '327e92f7-64f0-48b9-9e48-73611d8cb406',
  '5894f52e-d65f-4618-aa4c-39bfd9511663',
  'Ferrante', NULL, 'Ferrante'
);

-- 5. Fix premium for policy 9479008.
UPDATE titoli SET premio_lordo = 16022.50
WHERE numero_titolo = '9479008.' AND id = '074979de-381b-4775-9549-de3fbef5cf6b';
