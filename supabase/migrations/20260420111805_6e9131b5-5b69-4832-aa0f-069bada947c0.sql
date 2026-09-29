-- A) ELIMINA TUTTI i 4 rinnovi del titolo 332437574 / 2027-04-04 (richiesta utente)
DELETE FROM movimenti_polizza
WHERE titolo_id IN (
  '9bf5df4e-b9c7-4391-9858-fad4ce0b0036'::uuid,
  '086f2fef-3f89-4a9c-acd4-c33a55b626ef'::uuid,
  '5de9992d-07a4-4ade-9db5-39d646c6200c'::uuid,
  'e98aa651-890b-420f-b181-2fb577ebe63e'::uuid
);

DELETE FROM log_attivita
WHERE entita_tipo = 'titolo'
  AND entita_id IN (
    '9bf5df4e-b9c7-4391-9858-fad4ce0b0036'::uuid,
    '086f2fef-3f89-4a9c-acd4-c33a55b626ef'::uuid,
    '5de9992d-07a4-4ade-9db5-39d646c6200c'::uuid,
    'e98aa651-890b-420f-b181-2fb577ebe63e'::uuid
  );

DELETE FROM titoli
WHERE id IN (
  '9bf5df4e-b9c7-4391-9858-fad4ce0b0036'::uuid,
  '086f2fef-3f89-4a9c-acd4-c33a55b626ef'::uuid,
  '5de9992d-07a4-4ade-9db5-39d646c6200c'::uuid,
  'e98aa651-890b-420f-b181-2fb577ebe63e'::uuid
);

-- B) Cleanup duplicati legacy (mantieni rn=1, elimina rn>=2)
DELETE FROM movimenti_polizza
WHERE titolo_id IN (
  '7dfdbdf5-8344-4db6-b631-816ff36102d7'::uuid,
  'd6ff8c91-aa38-4dfb-9d3a-3318f0b3ccb9'::uuid,
  '6c915166-3a83-46f5-8120-aca0c1db780c'::uuid
);

DELETE FROM log_attivita
WHERE entita_tipo = 'titolo'
  AND entita_id IN (
    '7dfdbdf5-8344-4db6-b631-816ff36102d7'::uuid,
    'd6ff8c91-aa38-4dfb-9d3a-3318f0b3ccb9'::uuid,
    '6c915166-3a83-46f5-8120-aca0c1db780c'::uuid
  );

DELETE FROM titoli
WHERE id IN (
  '7dfdbdf5-8344-4db6-b631-816ff36102d7'::uuid,
  'd6ff8c91-aa38-4dfb-9d3a-3318f0b3ccb9'::uuid,
  '6c915166-3a83-46f5-8120-aca0c1db780c'::uuid
);

-- C) Unique index parziale: blocca a livello DB la creazione di rinnovi duplicati
CREATE UNIQUE INDEX IF NOT EXISTS titoli_no_duplicati_rinnovo
ON titoli (numero_titolo, compagnia_id, data_scadenza)
WHERE numero_titolo IS NOT NULL AND data_scadenza IS NOT NULL;