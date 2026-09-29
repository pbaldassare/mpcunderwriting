DO $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.titoli WHERE numero_titolo = '184667297';
  IF v_ids IS NULL THEN RETURN; END IF;

  DELETE FROM public.premi_garanzia_polizza WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.movimenti_polizza      WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.veicoli_polizza        WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.conducenti_polizza     WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.appendici_polizza      WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.titoli_split_commerciali WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.titoli_numeri_storici  WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.titoli_eventi_snapshot WHERE titolo_id = ANY(v_ids);

  DELETE FROM public.titoli WHERE id = ANY(v_ids);
END $$;