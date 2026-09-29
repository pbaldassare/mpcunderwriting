
-- 1. Tabella rapporti N:N agenzia ↔ compagnia madre
CREATE TABLE public.compagnia_rapporti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid NOT NULL REFERENCES public.compagnie(id) ON DELETE CASCADE,
  gruppo_compagnia_id uuid NOT NULL REFERENCES public.gruppi_compagnia(id) ON DELETE RESTRICT,
  codice_rapporto text,
  tipo_rapporto text,
  rami_abilitati text[],
  data_inizio date DEFAULT CURRENT_DATE,
  data_fine date,
  attivo boolean NOT NULL DEFAULT true,
  percentuale_provvigione numeric(5,2),
  iban_dedicato text,
  referente_compagnia text,
  email_referente text,
  telefono_referente text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_compagnia_rapporti_compagnia ON public.compagnia_rapporti(compagnia_id);
CREATE INDEX idx_compagnia_rapporti_gruppo ON public.compagnia_rapporti(gruppo_compagnia_id);
CREATE INDEX idx_compagnia_rapporti_attivo ON public.compagnia_rapporti(attivo) WHERE attivo = true;

-- 2. Trigger updated_at
CREATE TRIGGER trg_compagnia_rapporti_updated_at
  BEFORE UPDATE ON public.compagnia_rapporti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Trigger per popolare created_by/updated_by
CREATE OR REPLACE FUNCTION public.compagnia_rapporti_set_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compagnia_rapporti_set_user
  BEFORE INSERT OR UPDATE ON public.compagnia_rapporti
  FOR EACH ROW EXECUTE FUNCTION public.compagnia_rapporti_set_user();

-- 4. RLS
ALTER TABLE public.compagnia_rapporti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rapporti"
  ON public.compagnia_rapporti FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert rapporti"
  ON public.compagnia_rapporti FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update rapporti"
  ON public.compagnia_rapporti FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete rapporti"
  ON public.compagnia_rapporti FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Backfill: crea un rapporto iniziale per ogni agenzia con gruppo già collegato
INSERT INTO public.compagnia_rapporti (compagnia_id, gruppo_compagnia_id, tipo_rapporto, attivo, note)
SELECT c.id, c.gruppo_compagnia_id, 'Mandato principale', true, 'Rapporto migrato automaticamente dal collegamento legacy'
FROM public.compagnie c
WHERE c.gruppo_compagnia_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.compagnia_rapporti r
    WHERE r.compagnia_id = c.id AND r.gruppo_compagnia_id = c.gruppo_compagnia_id
  );

-- 6. Trigger di logging su log_attivita (se la tabella esiste)
CREATE OR REPLACE FUNCTION public.log_compagnia_rapporto_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_compagnia_id uuid;
  v_gruppo_nome text;
  v_compagnia_nome text;
  v_action text;
  v_descrizione text;
BEGIN
  v_compagnia_id := COALESCE(NEW.compagnia_id, OLD.compagnia_id);

  SELECT nome INTO v_compagnia_nome FROM public.compagnie WHERE id = v_compagnia_id;
  SELECT descrizione INTO v_gruppo_nome FROM public.gruppi_compagnia
    WHERE id = COALESCE(NEW.gruppo_compagnia_id, OLD.gruppo_compagnia_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'rapporto_creato';
    v_descrizione := 'Nuovo rapporto con compagnia: ' || COALESCE(v_gruppo_nome, '?');
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'rapporto_modificato';
    v_descrizione := 'Modificato rapporto con: ' || COALESCE(v_gruppo_nome, '?');
    IF OLD.attivo = true AND NEW.attivo = false THEN
      v_descrizione := 'Chiuso rapporto con: ' || COALESCE(v_gruppo_nome, '?');
    END IF;
  ELSE
    v_action := 'rapporto_eliminato';
    v_descrizione := 'Eliminato rapporto con: ' || COALESCE(v_gruppo_nome, '?');
  END IF;

  BEGIN
    INSERT INTO public.log_attivita (entita_tipo, entita_id, azione, descrizione, user_id, severity, metadata)
    VALUES (
      'compagnia',
      v_compagnia_id,
      v_action,
      v_descrizione,
      auth.uid(),
      'info',
      jsonb_build_object(
        'rapporto_id', COALESCE(NEW.id, OLD.id),
        'gruppo_compagnia_id', COALESCE(NEW.gruppo_compagnia_id, OLD.gruppo_compagnia_id),
        'compagnia_nome', v_compagnia_nome,
        'gruppo_nome', v_gruppo_nome
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- non bloccare se il logging fallisce
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_log_compagnia_rapporto_change
  AFTER INSERT OR UPDATE OR DELETE ON public.compagnia_rapporti
  FOR EACH ROW EXECUTE FUNCTION public.log_compagnia_rapporto_change();
