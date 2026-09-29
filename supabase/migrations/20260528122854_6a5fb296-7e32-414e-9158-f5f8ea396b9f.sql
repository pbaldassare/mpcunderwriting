DO $$
DECLARE
  v_ids uuid[] := ARRAY['55b7bd2a-8336-4c39-8097-b3e912301d43'::uuid,'5e3852a9-13d4-4be6-9d60-7c888a97c7ea'::uuid];
BEGIN
  DELETE FROM public.rimessa_dettaglio WHERE titolo_id = ANY(v_ids);
  DELETE FROM public.log_attivita WHERE entita_id = ANY(v_ids);
  DELETE FROM public.titoli WHERE id = ANY(v_ids);
END$$;