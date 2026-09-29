-- Il cron chiama la edge function dedicata di flush (non l'invio diretto).
CREATE OR REPLACE FUNCTION public.invoke_flush_messa_cassa_serale()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_apikey text;
  v_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.messa_cassa_notifiche_coda x
    WHERE (
      (x.status = 'pending' AND x.scheduled_for <= now())
      OR (
        x.status = 'processing'
        AND x.claimed_at IS NOT NULL
        AND x.claimed_at < now() - interval '15 minutes'
      )
    )
    LIMIT 1
  ) THEN
    RETURN 0;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_apikey
  FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;

  v_url := COALESCE(NULLIF(v_url, ''), 'https://zbjmnnlojxprlogbnxef.supabase.co');

  SELECT net.http_post(
    url := v_url || '/functions/v1/flush-messa-cassa-serale',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_apikey, ''),
      'apikey', COALESCE(v_apikey, '')
    ),
    body := jsonb_build_object(
      'source', 'pg_cron'
    ),
    timeout_milliseconds := 180000
  ) INTO v_id;

  RETURN v_id;
END;
$$;
