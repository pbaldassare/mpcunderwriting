-- Centralized excluded fields configuration + dedup protection for audit trail

-- 1) Settings table for audit configuration (single row, key-value)
CREATE TABLE IF NOT EXISTS public.audit_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- singleton
  excluded_fields text[] NOT NULL DEFAULT ARRAY['updated_at','created_at','search_vector','tsv','updated_by','created_by'],
  dedup_window_seconds int NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.audit_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.audit_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_config_read_authenticated" ON public.audit_config;
CREATE POLICY "audit_config_read_authenticated" ON public.audit_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_config_admin_write" ON public.audit_config;
CREATE POLICY "audit_config_admin_write" ON public.audit_config
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin'));

-- 2) Mark duplicates flag column on log_attivita
ALTER TABLE public.log_attivita ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false;

-- 3) Replace audit function: read excluded fields from config + dedup detection
CREATE OR REPLACE FUNCTION public.audit_row_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
  v_excluded text[];
  v_dedup_sec int;
  v_entita_tipo text := TG_ARGV[0];
  v_entita_id uuid;
  v_azione text;
  v_descrizione text;
  v_user uuid;
  v_is_dup boolean := false;
BEGIN
  v_user := auth.uid();

  -- Carica configurazione (con fallback)
  SELECT excluded_fields, dedup_window_seconds
    INTO v_excluded, v_dedup_sec
    FROM public.audit_config WHERE id = true;
  IF v_excluded IS NULL THEN
    v_excluded := ARRAY['updated_at','created_at','search_vector','tsv','updated_by','created_by'];
  END IF;
  IF v_dedup_sec IS NULL THEN v_dedup_sec := 2; END IF;

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

  -- Rileva duplicato: stesso utente/entita/azione con stessi changes negli ultimi N secondi
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.log_attivita
      WHERE entita_tipo = v_entita_tipo
        AND entita_id = v_entita_id
        AND azione = v_azione
        AND COALESCE(user_id::text,'') = COALESCE(v_user::text,'')
        AND created_at > now() - make_interval(secs => v_dedup_sec)
        AND COALESCE(dettagli_json->'changes', '{}'::jsonb) = v_changes
    ) INTO v_is_dup;
  EXCEPTION WHEN OTHERS THEN
    v_is_dup := false;
  END;

  BEGIN
    INSERT INTO public.log_attivita (
      entita_tipo, entita_id, azione, user_id, severity, dettagli_json, is_duplicate
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
      ),
      v_is_dup
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
