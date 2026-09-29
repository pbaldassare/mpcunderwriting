-- Lettura API key Resend dal Vault. Solo service_role (edge function).
-- Il valore sta in vault.secrets, non in questo file.

CREATE OR REPLACE FUNCTION public.resend_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api text;
BEGIN
  SELECT decrypted_secret INTO v_api
  FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  RETURN jsonb_build_object('api_key', v_api);
END;
$$;

REVOKE ALL ON FUNCTION public.resend_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resend_config() FROM anon;
REVOKE ALL ON FUNCTION public.resend_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resend_config() TO service_role;

COMMENT ON FUNCTION public.resend_config() IS
  'API key Resend da Vault. Eseguibile solo da service_role.';
