DO $$
DECLARE
  v_keepers uuid[] := ARRAY[
    '6d6046c4-a03d-49ca-a2f7-95d68d26d4d5',
    '60a913a7-ce11-4e77-b795-0259be9b0fa4',
    '8ef5ec10-b1ca-474b-9126-7f7fc0401e69',
    '79117ec1-e0ce-4fe2-a754-79ba6ab35d7a',
    '827e49d7-e80e-4d8d-9e38-9494ac502497',
    '443ee5a2-fdb3-4d0c-8029-186f02769241',
    '5894f52e-d65f-4618-aa4c-39bfd9511663',
    'fe446bf7-7abc-4dbb-9199-4435b14ef37c',
    'a17c3f40-43c5-4e75-ab64-27ae6cf59a74',
    'f9d34db3-dd50-4bf6-877d-7a572d1cc5d9',
    '58e15572-7ec3-4b27-9715-23be5aa48416',
    '746aed8c-67fc-435e-9e88-70991ea03097'
  ]::uuid[];
BEGIN
  PERFORM set_config('app.bypass_premi_lock','on', true);
  PERFORM set_config('app.bypass_messa_cassa_lock','on', true);
  SET session_replication_role = 'replica';

  CREATE TEMP TABLE _tit_del AS
  SELECT id FROM titoli
  WHERE cliente_anagrafica_id IS NULL OR NOT (cliente_anagrafica_id = ANY(v_keepers));

  CREATE TEMP TABLE _cli_del AS
  SELECT id FROM clienti WHERE NOT (id = ANY(v_keepers));

  DELETE FROM sinistri WHERE cliente_anagrafica_id IS NULL OR NOT (cliente_anagrafica_id = ANY(v_keepers));
  UPDATE sinistri SET titolo_id = NULL WHERE titolo_id IN (SELECT id FROM _tit_del);

  DELETE FROM trattative WHERE cliente_id IS NULL OR NOT (cliente_id = ANY(v_keepers));

  DELETE FROM note_restituzione_dettaglio WHERE titolo_id IN (SELECT id FROM _tit_del);
  DELETE FROM rimessa_dettaglio WHERE titolo_id IN (SELECT id FROM _tit_del);

  DELETE FROM documenti
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id FROM _tit_del))
     OR (entita_tipo='sinistro' AND entita_id NOT IN (SELECT id FROM sinistri))
     OR (entita_tipo='trattativa' AND entita_id NOT IN (SELECT id FROM trattative));

  DELETE FROM chat_messaggi
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id FROM _tit_del));
  DELETE FROM chat_canali
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id::text FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id::text FROM _tit_del));

  DELETE FROM portafoglio_incassi WHERE cliente_id IN (SELECT id FROM _cli_del);
  DELETE FROM note_restituzione WHERE cliente_id IN (SELECT id FROM _cli_del);

  UPDATE storico_gare SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM _cli_del);
  UPDATE prospect SET convertito_cliente_id = NULL WHERE convertito_cliente_id IN (SELECT id FROM _cli_del);

  DELETE FROM anomalie_sistema
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id FROM _tit_del));

  DELETE FROM notifiche
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id FROM _tit_del));

  DELETE FROM log_attivita
  WHERE (entita_tipo='cliente' AND entita_id IN (SELECT id FROM _cli_del))
     OR (entita_tipo='titolo'  AND entita_id IN (SELECT id FROM _tit_del));

  DELETE FROM titoli WHERE id IN (SELECT id FROM _tit_del);

  DELETE FROM clienti_merge_log WHERE cliente_master_id IN (SELECT id FROM _cli_del);
  UPDATE clienti SET merged_into = NULL
  WHERE merged_into IN (SELECT id FROM _cli_del) AND id = ANY(v_keepers);

  DELETE FROM clienti WHERE id IN (SELECT id FROM _cli_del);

  DROP TABLE _tit_del;
  DROP TABLE _cli_del;
  SET session_replication_role = 'origin';

  RAISE NOTICE 'Pulizia completata. Clienti: %, Titoli: %',
    (SELECT COUNT(*) FROM clienti), (SELECT COUNT(*) FROM titoli);
END $$;