-- Nessuno, admin compreso, può sospendere il proprio account.
-- Sospendere un altro utente resta possibile solo con il ruolo di sistema admin (policy UPDATE).
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND OLD.attivo IS DISTINCT FROM false
     AND NEW.attivo IS NOT TRUE THEN
    RAISE EXCEPTION 'Non puoi disattivare il tuo account';
  END IF;

  IF auth.uid() = NEW.id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.ruolo IS DISTINCT FROM OLD.ruolo
       OR NEW.ufficio_id IS DISTINCT FROM OLD.ufficio_id
       OR NEW.permessi_json IS DISTINCT FROM OLD.permessi_json THEN
      RAISE EXCEPTION 'Non puoi modificare ruolo, ufficio o permessi del tuo profilo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
