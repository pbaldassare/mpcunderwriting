-- One-shot cleanup: CAMERA DI COMMERCIO DI SALERNO transactional data
-- Preserves cliente anagrafica; never touches intentional duplicate polizze 204366651, 6131402092, RCM00010074404
DO $$
DECLARE
  v_cliente_id uuid := '5bf442ef-f109-4457-9c2c-127e986ca145';
  v_tit_ids uuid[];
  v_pol_ids uuid[];
  v_qui_ids uuid[];
  v_prov_ids uuid[];
  v_rimesse_ids uuid[];
  v_mb_ids uuid[];
  -- counts
  c_pag_righe int := 0;
  c_prov int := 0;
  c_rim_dett int := 0;
  c_mov_cont int := 0;
  c_mov_pol int := 0;
  c_mov_polizze int := 0;
  c_det_riparto int := 0;
  c_compensazioni int := 0;
  c_eventi int := 0;
  c_splits int := 0;
  c_sost int := 0;
  c_storni int := 0;
  c_regol int := 0;
  c_numeri int := 0;
  c_anticipi int := 0;
  c_veicoli int := 0;
  c_conducenti int := 0;
  c_cga int := 0;
  c_cga_premi int := 0;
  c_cga_gar int := 0;
  c_libro int := 0;
  c_appendici int := 0;
  c_premi int := 0;
  c_port_inc_ev int := 0;
  c_port_inc int := 0;
  c_incroci int := 0;
  c_mb int := 0;
  c_note_det int := 0;
  c_sin_upd int := 0;
  c_quietanze int := 0;
  c_titoli int := 0;
  c_polizze int := 0;
  c_rim_testate int := 0;
BEGIN
  -- Safety: never touch intentional duplicate polizze
  IF EXISTS (
    SELECT 1 FROM titoli
    WHERE cliente_anagrafica_id = v_cliente_id
      AND numero_titolo IN ('204366651', '6131402092', 'RCM00010074404')
  ) THEN
    RAISE EXCEPTION 'Blocked: cliente has intentional duplicate polizza numbers';
  END IF;

  PERFORM set_config('app.bypass_premi_lock', 'on', true);
  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_pol_ids
  FROM polizze WHERE cliente_anagrafica_id = v_cliente_id;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_tit_ids
  FROM titoli
  WHERE cliente_id = v_cliente_id OR cliente_anagrafica_id = v_cliente_id;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_qui_ids
  FROM quietanze WHERE polizza_id = ANY(v_pol_ids);

  IF cardinality(v_tit_ids) = 0 AND cardinality(v_pol_ids) = 0 THEN
    RAISE NOTICE 'Nothing to delete for cliente %', v_cliente_id;
    RETURN;
  END IF;

  -- Provvigioni ids
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_prov_ids
  FROM provvigioni_generate
  WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids);

  -- Rimesse coinvolte
  SELECT coalesce(array_agg(DISTINCT rimessa_id), ARRAY[]::uuid[]) INTO v_rimesse_ids
  FROM rimessa_dettaglio
  WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids);

  -- Movimenti bancari cliente
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_mb_ids
  FROM movimenti_bancari WHERE cliente_id = v_cliente_id;

  -- 1. pagamenti_provvigioni_righe
  IF cardinality(v_prov_ids) > 0 THEN
    WITH d AS (DELETE FROM pagamenti_provvigioni_righe WHERE provvigione_id = ANY(v_prov_ids) RETURNING 1)
    SELECT count(*) INTO c_pag_righe FROM d;
  END IF;

  -- 2. provvigioni_generate
  WITH d AS (DELETE FROM provvigioni_generate
             WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_prov FROM d;

  -- 3. rimessa_dettaglio
  WITH d AS (DELETE FROM rimessa_dettaglio
             WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_rim_dett FROM d;

  -- 4. note_restituzione_dettaglio
  WITH d AS (DELETE FROM note_restituzione_dettaglio
             WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_note_det FROM d;

  -- 5. movimenti_contabili
  WITH d AS (DELETE FROM movimenti_contabili
             WHERE riferimento_tipo = 'titolo' AND riferimento_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_mov_cont FROM d;

  -- 6. movimenti_polizza
  WITH d AS (DELETE FROM movimenti_polizza WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_mov_pol FROM d;

  -- 7. movimenti_polizze (N:N bancario)
  WITH d AS (DELETE FROM movimenti_polizze WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_mov_polizze FROM d;

  -- 8. incroci_bancari linked to cliente movimenti bancari
  IF cardinality(v_mb_ids) > 0 THEN
    WITH d AS (DELETE FROM incroci_bancari WHERE movimento_bancario_id = ANY(v_mb_ids) RETURNING 1)
    SELECT count(*) INTO c_incroci FROM d;
    WITH d AS (DELETE FROM movimenti_bancari WHERE id = ANY(v_mb_ids) RETURNING 1)
    SELECT count(*) INTO c_mb FROM d;
  END IF;

  -- 9. dettaglio_riparto
  WITH d AS (DELETE FROM dettaglio_riparto WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_det_riparto FROM d;

  -- 10. titoli_compensazioni
  WITH d AS (DELETE FROM titoli_compensazioni WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_compensazioni FROM d;

  -- 11. titoli_eventi_snapshot
  WITH d AS (DELETE FROM titoli_eventi_snapshot WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_eventi FROM d;

  -- 12. titoli_split_commerciali
  WITH d AS (DELETE FROM titoli_split_commerciali WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_splits FROM d;

  -- 13. titoli_sostituzioni
  WITH d AS (DELETE FROM titoli_sostituzioni
             WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_sost FROM d;

  -- 14. titoli_storni
  WITH d AS (DELETE FROM titoli_storni
             WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_storni FROM d;

  -- 15. titoli_regolazioni
  WITH d AS (DELETE FROM titoli_regolazioni
             WHERE titolo_madre_id = ANY(v_tit_ids) OR titolo_regolazione_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_regol FROM d;

  -- 16. titoli_numeri_storici
  WITH d AS (DELETE FROM titoli_numeri_storici WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_numeri FROM d;

  -- 17. cliente_anticipi_utilizzi
  WITH d AS (DELETE FROM cliente_anticipi_utilizzi WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_anticipi FROM d;

  -- 18. veicoli / conducenti
  WITH d AS (DELETE FROM veicoli_polizza WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_veicoli FROM d;
  WITH d AS (DELETE FROM conducenti_polizza WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_conducenti FROM d;

  -- 19. polizza_cga children
  WITH d AS (DELETE FROM polizza_cga_premio_garanzia
             WHERE polizza_cga_id IN (SELECT id FROM polizza_cga WHERE titolo_id = ANY(v_tit_ids)) RETURNING 1)
  SELECT count(*) INTO c_cga_premi FROM d;
  WITH d AS (DELETE FROM polizza_garanzie_personali
             WHERE polizza_cga_id IN (SELECT id FROM polizza_cga WHERE titolo_id = ANY(v_tit_ids)) RETURNING 1)
  SELECT count(*) INTO c_cga_gar FROM d;
  WITH d AS (DELETE FROM polizza_cga WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_cga FROM d;

  -- 20. libro_matricola_mezzi
  WITH d AS (DELETE FROM libro_matricola_mezzi WHERE titolo_id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_libro FROM d;

  -- 21. appendici_polizza
  WITH d AS (DELETE FROM appendici_polizza
             WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_appendici FROM d;

  -- 22. premi_garanzia_polizza
  WITH d AS (DELETE FROM premi_garanzia_polizza
             WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) OR quietanza_id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_premi FROM d;

  -- 23. portafoglio_incassi
  WITH d AS (DELETE FROM portafoglio_incassi_eventi
             WHERE portafoglio_id IN (SELECT id FROM portafoglio_incassi WHERE cliente_id = v_cliente_id) RETURNING 1)
  SELECT count(*) INTO c_port_inc_ev FROM d;
  WITH d AS (DELETE FROM portafoglio_incassi WHERE cliente_id = v_cliente_id RETURNING 1)
  SELECT count(*) INTO c_port_inc FROM d;

  -- 24. sinistri: unlink only
  WITH u AS (UPDATE sinistri SET titolo_id = NULL, polizza_id = NULL
             WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_sin_upd FROM u;

  -- 25. Nullify cross-refs before deletes
  UPDATE polizze SET
    titolo_madre_id = NULL,
    sostituisce_polizza_id = NULL,
    sostituita_da_polizza_id = NULL
  WHERE id = ANY(v_pol_ids);

  UPDATE quietanze SET titolo_id = NULL WHERE id = ANY(v_qui_ids);

  UPDATE titoli SET
    regolazione_quietanza_id = NULL,
    titolo_storno_id = NULL,
    polizza_id = NULL,
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    data_conferimento_gestito = NULL
  WHERE id = ANY(v_tit_ids);

  -- 26. quietanze (RESTRICT on polizza)
  WITH d AS (DELETE FROM quietanze WHERE id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_quietanze FROM d;

  -- 27. titoli (children first via riga desc)
  WITH d AS (
    DELETE FROM titoli
    WHERE id = ANY(v_tit_ids)
    RETURNING 1
  )
  SELECT count(*) INTO c_titoli FROM d;

  -- 28. polizze
  WITH d AS (DELETE FROM polizze WHERE id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_polizze FROM d;

  -- 29. empty rimessa testate
  IF cardinality(v_rimesse_ids) > 0 THEN
    WITH d AS (
      DELETE FROM rimessa_premi rp
      WHERE rp.id = ANY(v_rimesse_ids)
        AND NOT EXISTS (SELECT 1 FROM rimessa_dettaglio rd WHERE rd.rimessa_id = rp.id)
      RETURNING 1
    )
    SELECT count(*) INTO c_rim_testate FROM d;
  END IF;

  RAISE NOTICE 'DELETE REPORT cliente=% titoli=% quietanze=% polizze=% premi_garanzia=% movimenti_polizza=% provvigioni=% pag_righe=% rimessa_det=% mov_cont=% mov_polizze=% incroci=% mov_bancari=% compensazioni=% portafoglio_incassi=%',
    v_cliente_id, c_titoli, c_quietanze, c_polizze, c_premi, c_mov_pol, c_prov, c_pag_righe, c_rim_dett, c_mov_cont, c_mov_polizze, c_incroci, c_mb, c_compensazioni, c_port_inc;
END $$;

-- Verification
SELECT
  (SELECT count(*) FROM clienti WHERE id = '5bf442ef-f109-4457-9c2c-127e986ca145') AS cliente_exists,
  (SELECT count(*) FROM titoli WHERE cliente_anagrafica_id = '5bf442ef-f109-4457-9c2c-127e986ca145') AS titoli_remaining,
  (SELECT count(*) FROM polizze WHERE cliente_anagrafica_id = '5bf442ef-f109-4457-9c2c-127e986ca145') AS polizze_remaining,
  (SELECT count(*) FROM quietanze q JOIN polizze p ON p.id = q.polizza_id WHERE p.cliente_anagrafica_id = '5bf442ef-f109-4457-9c2c-127e986ca145') AS quietanze_remaining;
