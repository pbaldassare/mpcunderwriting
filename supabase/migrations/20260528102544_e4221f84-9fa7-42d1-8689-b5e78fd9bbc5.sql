DO $$
DECLARE
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM titoli WHERE numero_titolo='184667297' OR sostituisce_polizza='184667297';
  IF ids IS NULL OR array_length(ids,1)=0 THEN RETURN; END IF;

  DELETE FROM premi_garanzia_polizza WHERE titolo_id = ANY(ids);
  DELETE FROM movimenti_polizza WHERE titolo_id = ANY(ids);
  DELETE FROM veicoli_polizza WHERE titolo_id = ANY(ids);
  DELETE FROM conducenti_polizza WHERE titolo_id = ANY(ids);
  DELETE FROM appendici_polizza WHERE titolo_id = ANY(ids);
  DELETE FROM titoli_split_commerciali WHERE titolo_id = ANY(ids);
  DELETE FROM titoli_numeri_storici WHERE titolo_id = ANY(ids);
  DELETE FROM titoli_eventi_snapshot WHERE titolo_id = ANY(ids);
  DELETE FROM provvigioni_generate WHERE titolo_id = ANY(ids);
  DELETE FROM movimenti_contabili WHERE riferimento_tipo='titolo' AND riferimento_id = ANY(ids);
  DELETE FROM titoli WHERE id = ANY(ids);
END $$;