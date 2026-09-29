
-- Tabella anagrafiche professionali: liquidatori, periti, legali, account executive, corrispondenti
CREATE TABLE public.anagrafiche_professionali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- liquidatore, perito, legale, account_executive, corrispondente
  nome text,
  cognome text,
  ragione_sociale text,
  codice_fiscale text,
  partita_iva text,
  email text,
  pec text,
  telefono text,
  cellulare text,
  fax text,
  indirizzo text,
  cap text,
  citta text,
  provincia text,
  compagnia_id uuid REFERENCES public.compagnie(id),
  specializzazione text,
  albo_numero text,
  note text,
  attivo boolean DEFAULT true,
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_anagrafiche_professionali
  BEFORE UPDATE ON public.anagrafiche_professionali
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_anagrafiche_professionali_tipo()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo NOT IN ('liquidatore','perito','legale','account_executive','corrispondente') THEN
    RAISE EXCEPTION 'Invalid tipo: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_anagrafiche_tipo
  BEFORE INSERT OR UPDATE ON public.anagrafiche_professionali
  FOR EACH ROW EXECUTE FUNCTION public.validate_anagrafiche_professionali_tipo();

-- RLS
ALTER TABLE public.anagrafiche_professionali ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all anagrafiche_prof" ON public.anagrafiche_professionali
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select anagrafiche_prof" ON public.anagrafiche_professionali
  FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'));

CREATE POLICY "Contabilita select anagrafiche_prof" ON public.anagrafiche_professionali
  FOR SELECT TO public USING (has_role(auth.uid(), 'contabilita'));

CREATE POLICY "Ufficio select own anagrafiche_prof" ON public.anagrafiche_professionali
  FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio') AND (ufficio_id = get_my_ufficio_id() OR ufficio_id IS NULL));

CREATE POLICY "Ufficio insert own anagrafiche_prof" ON public.anagrafiche_professionali
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'ufficio') AND (ufficio_id = get_my_ufficio_id()));

CREATE POLICY "Ufficio update own anagrafiche_prof" ON public.anagrafiche_professionali
  FOR UPDATE TO public USING (has_role(auth.uid(), 'ufficio') AND (ufficio_id = get_my_ufficio_id()));

CREATE POLICY "Produttore select anagrafiche_prof" ON public.anagrafiche_professionali
  FOR SELECT TO public USING (has_role(auth.uid(), 'produttore'));
