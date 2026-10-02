-- Chiave IA leggibile dalle edge function quando non è nei secret Edge.
-- Stesso schema già usato da resend_config(): il valore resta nel vault, mai nel repo.

CREATE OR REPLACE FUNCTION public.ai_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api text;
BEGIN
  SELECT decrypted_secret INTO v_api
  FROM vault.decrypted_secrets WHERE name = 'MOONSHOT_API_KEY' LIMIT 1;
  RETURN jsonb_build_object('api_key', v_api);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_config() FROM public;
REVOKE ALL ON FUNCTION public.ai_config() FROM anon;
REVOKE ALL ON FUNCTION public.ai_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ai_config() TO service_role;
