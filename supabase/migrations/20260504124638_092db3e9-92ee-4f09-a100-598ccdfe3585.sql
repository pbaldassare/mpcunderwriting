
-- Funzione generica di audit: confronta OLD vs NEW e registra solo i campi cambiati
CREATE OR REPLACE FUNCTION public.audit_row_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
  v_excluded text[] := ARRAY['updated_at','created_at','search_vector','tsv','updated_by','created_by'];
  v_entita_tipo text := TG_ARGV[0];
  v_entita_id uuid;
  v_azione text;
  v_descrizione text;
  v_user uuid;
BEGIN
  v_user := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_entita_id := NEW.id;
    v_azione := v_entita_tipo || '_creato';
    v_descrizione := 'Creato nuovo record ' || v_entita_tipo;
    v_changes := to_jsonb(NEW) - v_excluded;

  ELSIF TG_OP = 'DELETE' THEN
    v_entita_id := OLD.id;
    v_azione := v_entita_tipo || '_eliminato';
    v_descrizione := 'Eliminato record ' || v_entita_tipo;
    v_changes := to_jsonb(OLD) - v_excluded;

  ELSE -- UPDATE
    v_entita_id := NEW.id;
    v_azione := v_entita_tipo || '_modificato';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_excluded) THEN CONTINUE; END IF;
      v_old_val := v_old -> v_key;
      v_new_val := v_new -> v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old_val, 'new', v_new_val)
        );
      END IF;
    END LOOP;

    -- Nessun campo significativo cambiato: non loggare
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_descrizione := 'Modificati ' || (SELECT COUNT(*) FROM jsonb_object_keys(v_changes)) || ' campi';
  END IF;

  BEGIN
    INSERT INTO public.log_attivita (
      entita_tipo, entita_id, azione, user_id, severity, dettagli_json
    ) VALUES (
      v_entita_tipo,
      v_entita_id,
      v_azione,
      v_user,
      'info',
      jsonb_build_object(
        'descrizione', v_descrizione,
        'changes', v_changes,
        'op', TG_OP
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non bloccare mai l'operazione principale per un errore di logging
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- TITOLI (Polizze)
DROP TRIGGER IF EXISTS trg_audit_titoli ON public.titoli;
CREATE TRIGGER trg_audit_titoli
AFTER INSERT OR UPDATE OR DELETE ON public.titoli
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('titolo');

-- CLIENTI
DROP TRIGGER IF EXISTS trg_audit_clienti ON public.clienti;
CREATE TRIGGER trg_audit_clienti
AFTER INSERT OR UPDATE OR DELETE ON public.clienti
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('cliente');

-- SINISTRI
DROP TRIGGER IF EXISTS trg_audit_sinistri ON public.sinistri;
CREATE TRIGGER trg_audit_sinistri
AFTER INSERT OR UPDATE OR DELETE ON public.sinistri
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('sinistro');

-- TRATTATIVE
DROP TRIGGER IF EXISTS trg_audit_trattative ON public.trattative;
CREATE TRIGGER trg_audit_trattative
AFTER INSERT OR UPDATE OR DELETE ON public.trattative
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('trattativa');

-- COMPAGNIE
DROP TRIGGER IF EXISTS trg_audit_compagnie ON public.compagnie;
CREATE TRIGGER trg_audit_compagnie
AFTER INSERT OR UPDATE OR DELETE ON public.compagnie
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('compagnia');

-- Indice per accelerare le query del Log Attività per entità
CREATE INDEX IF NOT EXISTS idx_log_attivita_entita
  ON public.log_attivita (entita_tipo, entita_id, created_at DESC);
