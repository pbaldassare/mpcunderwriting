-- Lettura secret ID Guard dal Vault. Solo service_role (edge function).
-- I valori stanno in vault.secrets, non in questo file.

CREATE OR REPLACE FUNCTION public.idguard_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api text;
  v_client text;
  v_wh text;
BEGIN
  SELECT decrypted_secret INTO v_api
  FROM vault.decrypted_secrets WHERE name = 'IDGUARD_API_KEY' LIMIT 1;
  SELECT decrypted_secret INTO v_client
  FROM vault.decrypted_secrets WHERE name = 'IDGUARD_CLIENT_ID' LIMIT 1;
  SELECT decrypted_secret INTO v_wh
  FROM vault.decrypted_secrets WHERE name = 'IDGUARD_WEBHOOK_SECRET' LIMIT 1;
  RETURN jsonb_build_object(
    'api_key', v_api,
    'client_id', v_client,
    'webhook_secret', v_wh
  );
END;
$$;

REVOKE ALL ON FUNCTION public.idguard_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.idguard_config() FROM anon;
REVOKE ALL ON FUNCTION public.idguard_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.idguard_config() TO service_role;

COMMENT ON FUNCTION public.idguard_config() IS
  'Config ID Guard da Vault. Eseguibile solo da service_role.';
