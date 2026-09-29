DO $$
DECLARE
  v_cliente uuid := 'f59cb208-126c-4e8e-a62d-6226d3707185';
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM titoli WHERE cliente_anagrafica_id = v_cliente;
  IF v_ids IS NULL THEN
    RAISE NOTICE 'Nessun titolo da eliminare';
    RETURN;
  END IF;

  DELETE FROM provvigioni_generate     WHERE titolo_id = ANY(v_ids);
  DELETE FROM movimenti_polizza        WHERE titolo_id = ANY(v_ids);
  DELETE FROM premi_garanzia_polizza   WHERE titolo_id = ANY(v_ids);
  DELETE FROM titoli_eventi_snapshot   WHERE titolo_id = ANY(v_ids);
  DELETE FROM titoli                   WHERE id        = ANY(v_ids);
END $$;