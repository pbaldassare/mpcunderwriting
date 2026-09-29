
DO $$
DECLARE ids uuid[] := ARRAY['ae94fb3e-b97a-446a-9531-49953fa030f6'::uuid,'9fe77266-5eb1-43df-a06e-f2054c8327de'::uuid];
BEGIN
  DELETE FROM public.provvigioni_generate WHERE titolo_id = ANY(ids);
  DELETE FROM public.log_attivita WHERE entita_id = ANY(ids);
  DELETE FROM public.titoli WHERE id = ANY(ids);
END $$;
