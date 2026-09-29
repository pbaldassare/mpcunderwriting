-- Permette a service_role (auth.uid IS NULL) di aggiornare ruolo/ufficio/permessi su profiles.
-- Il blocco resta attivo per utenti autenticati non-admin.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.ruolo IS DISTINCT FROM OLD.ruolo THEN
    NEW.ruolo := OLD.ruolo;
  END IF;
  IF NEW.ufficio_id IS DISTINCT FROM OLD.ufficio_id THEN
    NEW.ufficio_id := OLD.ufficio_id;
  END IF;
  IF NEW.permessi_json IS DISTINCT FROM OLD.permessi_json THEN
    NEW.permessi_json := OLD.permessi_json;
  END IF;
  RETURN NEW;
END;
$$;

-- Helper SECURITY DEFINER per provisioning sedi
CREATE OR REPLACE FUNCTION public.admin_set_sede_profile(
  p_user_id uuid,
  p_nome text,
  p_cognome text,
  p_email text,
  p_ufficio_id uuid,
  p_permessi jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    nome = p_nome,
    cognome = p_cognome,
    email = p_email,
    ruolo = 'ufficio',
    ufficio_id = p_ufficio_id,
    attivo = true,
    permessi_json = p_permessi,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, nome, cognome, email, ruolo, ufficio_id, attivo, permessi_json)
    VALUES (p_user_id, p_nome, p_cognome, p_email, 'ufficio', p_ufficio_id, true, p_permessi);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_sede_profile(uuid, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_sede_profile(uuid, text, text, text, uuid, jsonb) TO service_role;
