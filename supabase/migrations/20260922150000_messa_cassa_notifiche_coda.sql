-- Coda notifiche «messa a cassa serale»: invio alle 19:30 Europe/Rome.

CREATE TABLE IF NOT EXISTS public.messa_cassa_notifiche_coda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_ids uuid[] NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'error')),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  processed_at timestamptz,
  error_message text,
  result_json jsonb
);

CREATE INDEX IF NOT EXISTS idx_messa_cassa_notifiche_coda_due
  ON public.messa_cassa_notifiche_coda (scheduled_for)
  WHERE status IN ('pending', 'processing');

COMMENT ON TABLE public.messa_cassa_notifiche_coda IS
  'Notifiche agenzia di messa a cassa pianificate per le 19:30 del giorno corrente.';

ALTER TABLE public.messa_cassa_notifiche_coda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messa_cassa_notifiche_coda_insert ON public.messa_cassa_notifiche_coda;
CREATE POLICY messa_cassa_notifiche_coda_insert
  ON public.messa_cassa_notifiche_coda
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IS NULL
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS messa_cassa_notifiche_coda_select ON public.messa_cassa_notifiche_coda;
CREATE POLICY messa_cassa_notifiche_coda_select
  ON public.messa_cassa_notifiche_coda
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'contabilita')
  );

GRANT SELECT, INSERT ON public.messa_cassa_notifiche_coda TO authenticated;
GRANT ALL ON public.messa_cassa_notifiche_coda TO service_role;

CREATE OR REPLACE FUNCTION public.claim_messa_cassa_notifiche_coda()
RETURNS TABLE (id uuid, titolo_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.messa_cassa_notifiche_coda c
  SET
    status = 'processing',
    claimed_at = now()
  WHERE c.id IN (
    SELECT x.id
    FROM public.messa_cassa_notifiche_coda x
    WHERE (
      (x.status = 'pending' AND x.scheduled_for <= now())
      OR (
        x.status = 'processing'
        AND x.claimed_at IS NOT NULL
        AND x.claimed_at < now() - interval '15 minutes'
      )
    )
    ORDER BY x.scheduled_for
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  )
  RETURNING c.id, c.titolo_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_messa_cassa_notifiche_coda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_messa_cassa_notifiche_coda() TO service_role;

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
    url := v_url || '/functions/v1/notifica-messa-cassa-agenzia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_apikey, ''),
      'apikey', COALESCE(v_apikey, '')
    ),
    body := jsonb_build_object(
      'flush_coda', true,
      'source', 'pg_cron'
    ),
    timeout_milliseconds := 180000
  ) INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_flush_messa_cassa_serale() FROM PUBLIC;

DO $$
BEGIN
  PERFORM cron.unschedule(j.jobid)
  FROM cron.job j
  WHERE j.jobname = 'flush-messa-cassa-serale';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'flush-messa-cassa-serale',
  '*/5 * * * *',
  $cron$SELECT public.invoke_flush_messa_cassa_serale()$cron$
);
