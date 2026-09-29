DO $$
DECLARE
  v_ids uuid[] := ARRAY['01fbb860-7d18-4ad5-918a-c3cb0d421704'::uuid, '5ce9667e-136e-4b3c-855f-39ddd7023246'::uuid];
BEGIN
  DELETE FROM public.rimessa_dettaglio WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.provvigioni_generate WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.log_attivita WHERE entita_id = ANY(v_ids);
  DELETE FROM public.titoli WHERE id = ANY(v_ids);
END $$;