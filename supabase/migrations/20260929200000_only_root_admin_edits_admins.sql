-- Solo admin@mpc.it può modificare un altro account amministratore.
-- Il service role (auth.uid() nullo) resta consentito: le edge function applicano lo stesso vincolo sul chiamante.

CREATE OR REPLACE FUNCTION public.is_root_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uid
      AND lower(btrim(email)) = 'admin@mpc.it'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_account(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid
      AND (ruolo = 'admin' OR lower(btrim(email)) = 'admin@mpc.it')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_uid AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NOT NULL
     AND NEW.id = actor
     AND OLD.attivo IS DISTINCT FROM false
     AND NEW.attivo IS NOT TRUE THEN
    RAISE EXCEPTION 'Non puoi disattivare il tuo account';
  END IF;

  IF actor = NEW.id AND NOT public.has_role(actor, 'admin'::public.app_role) THEN
    IF NEW.ruolo IS DISTINCT FROM OLD.ruolo
       OR NEW.ufficio_id IS DISTINCT FROM OLD.ufficio_id
       OR NEW.permessi_json IS DISTINCT FROM OLD.permessi_json THEN
      RAISE EXCEPTION 'Non puoi modificare ruolo, ufficio o permessi del tuo profilo';
    END IF;
  END IF;

  IF lower(btrim(COALESCE(NEW.email, ''))) = 'admin@mpc.it'
     AND lower(btrim(COALESCE(OLD.email, ''))) IS DISTINCT FROM 'admin@mpc.it' THEN
    RAISE EXCEPTION 'L''indirizzo admin@mpc.it è riservato';
  END IF;

  IF actor IS NOT NULL AND NOT public.is_root_admin(actor) THEN
    IF public.is_admin_account(OLD.id)
       AND actor IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Solo admin@mpc.it può modificare un altro account amministratore';
    END IF;

    IF NEW.ruolo = 'admin'
       AND OLD.ruolo IS DISTINCT FROM 'admin'
       AND actor IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Solo admin@mpc.it può assegnare il ruolo amministratore';
    END IF;
  END IF;

  IF lower(btrim(COALESCE(OLD.email, ''))) = 'admin@mpc.it'
     AND (
       NEW.ruolo IS DISTINCT FROM 'admin'
       OR lower(btrim(COALESCE(NEW.email, ''))) IS DISTINCT FROM 'admin@mpc.it'
     ) THEN
    RAISE EXCEPTION 'L''account admin@mpc.it non può perdere il ruolo di amministratore';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_admin_account_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF lower(btrim(COALESCE(OLD.email, ''))) = 'admin@mpc.it' THEN
    RAISE EXCEPTION 'Non puoi eliminare l''account admin@mpc.it';
  END IF;

  IF actor IS NULL THEN
    RETURN OLD;
  END IF;

  IF public.is_admin_account(OLD.id)
     AND actor IS DISTINCT FROM OLD.id
     AND NOT public.is_root_admin(actor) THEN
    RAISE EXCEPTION 'Solo admin@mpc.it può modificare un altro account amministratore';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_account_delete ON public.profiles;
CREATE TRIGGER trg_prevent_admin_account_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_account_delete();

CREATE OR REPLACE FUNCTION public.prevent_admin_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF lower(btrim(COALESCE(NEW.email, ''))) = 'admin@mpc.it' THEN
    RAISE EXCEPTION 'L''indirizzo admin@mpc.it è riservato';
  END IF;

  IF actor IS NOT NULL
     AND NEW.ruolo = 'admin'
     AND NOT public.is_root_admin(actor) THEN
    RAISE EXCEPTION 'Solo admin@mpc.it può assegnare il ruolo amministratore';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_profile_insert ON public.profiles;
CREATE TRIGGER trg_prevent_admin_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_profile_insert();

CREATE OR REPLACE FUNCTION public.prevent_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  role_touched public.app_role;
BEGIN
  IF TG_OP <> 'INSERT'
     AND public.is_root_admin(OLD.user_id)
     AND OLD.role = 'admin'::public.app_role
     AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'L''account admin@mpc.it non può perdere il ruolo di amministratore';
  END IF;

  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    target := OLD.user_id;
    role_touched := OLD.role;
  ELSE
    target := NEW.user_id;
    role_touched := NEW.role;
  END IF;

  IF public.is_root_admin(actor) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF role_touched = 'admin'::public.app_role
     OR public.is_admin_account(target) THEN
    IF actor IS DISTINCT FROM target THEN
      RAISE EXCEPTION 'Solo admin@mpc.it può modificare un altro account amministratore';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_role_change ON public.user_roles;
CREATE TRIGGER trg_prevent_admin_role_change
  BEFORE INSERT OR DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role_change();

CREATE OR REPLACE FUNCTION public.prevent_admin_sede_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT'
     AND public.is_admin_account(OLD.profilo_id)
     AND actor IS DISTINCT FROM OLD.profilo_id
     AND NOT public.is_root_admin(actor) THEN
    RAISE EXCEPTION 'Solo admin@mpc.it può modificare un altro account amministratore';
  END IF;

  IF TG_OP <> 'DELETE'
     AND public.is_admin_account(NEW.profilo_id)
     AND actor IS DISTINCT FROM NEW.profilo_id
     AND NOT public.is_root_admin(actor) THEN
    RAISE EXCEPTION 'Solo admin@mpc.it può modificare un altro account amministratore';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_sede_change ON public.profilo_sedi;
CREATE TRIGGER trg_prevent_admin_sede_change
  BEFORE INSERT OR DELETE OR UPDATE ON public.profilo_sedi
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_sede_change();
