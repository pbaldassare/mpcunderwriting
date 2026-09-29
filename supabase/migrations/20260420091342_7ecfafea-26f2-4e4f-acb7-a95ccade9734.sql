
DO $$
DECLARE
  v_titoli uuid[] := ARRAY[
    'd97f56e6-0000-0000-0000-000000000000'::uuid, -- placeholder, sostituito sotto
    '66c6cf18-0000-0000-0000-000000000000'::uuid
  ];
  v_id uuid;
  v_prov_count int;
BEGIN
  -- Risolvo gli ID reali per numero_titolo + data_messa_cassa in aprile 2026
  SELECT array_agg(id) INTO v_titoli
  FROM titoli
  WHERE numero_titolo IN ('332434490', '332437574')
    AND data_messa_cassa >= '2026-04-01'
    AND data_messa_cassa <= '2026-04-30';

  IF v_titoli IS NULL OR array_length(v_titoli, 1) = 0 THEN
    RAISE NOTICE 'Nessun titolo da resettare';
    RETURN;
  END IF;

  -- Safety: blocca se esistono provvigioni già pagate
  IF EXISTS (
    SELECT 1 FROM provvigioni_generate
    WHERE titolo_id = ANY(v_titoli) AND pagata = true
  ) THEN
    RAISE EXCEPTION 'Esistono provvigioni già pagate: abort';
  END IF;

  -- Elimina provvigioni non pagate
  DELETE FROM provvigioni_generate
  WHERE titolo_id = ANY(v_titoli) AND pagata = false;
  GET DIAGNOSTICS v_prov_count = ROW_COUNT;

  -- Elimina movimenti contabili collegati (se presenti)
  DELETE FROM movimenti_contabili
  WHERE riferimento_tipo = 'titolo' AND riferimento_id = ANY(v_titoli);

  -- Reset titoli
  UPDATE titoli
  SET stato = 'attivo',
      data_incasso = NULL,
      data_messa_cassa = NULL,
      data_pagamento = NULL,
      data_decorrenza_rinnovo = NULL,
      importo_incassato = NULL,
      tipo_pagamento = NULL,
      banca_pagamento = NULL,
      conferimento_gestito = false,
      fondi_ricevuti = true,
      data_conferimento_gestito = NULL,
      updated_at = now()
  WHERE id = ANY(v_titoli);

  -- Log audit
  FOREACH v_id IN ARRAY v_titoli LOOP
    INSERT INTO log_attivita (user_id, azione, entita_tipo, entita_id, dettagli_json, severity)
    VALUES (
      NULL,
      'annulla_messa_a_cassa',
      'titolo',
      v_id,
      jsonb_build_object('motivo', 'Reset aprile 2026 per test', 'provvigioni_eliminate_totali', v_prov_count),
      'warning'
    );
  END LOOP;
END $$;
