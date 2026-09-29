
-- Tabella note_restituzione
CREATE TABLE public.note_restituzione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid REFERENCES uffici(id),
  cliente_id uuid REFERENCES profiles(id),
  stato text NOT NULL DEFAULT 'bozza',
  flag_json jsonb DEFAULT '{}',
  note text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger for stato
CREATE OR REPLACE FUNCTION public.validate_nota_restituzione_stato()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.stato NOT IN ('bozza','pronta','spedita','chiusa') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_nota_restituzione_stato
BEFORE INSERT OR UPDATE ON public.note_restituzione
FOR EACH ROW EXECUTE FUNCTION public.validate_nota_restituzione_stato();

-- Updated_at trigger
CREATE TRIGGER update_note_restituzione_updated_at
BEFORE UPDATE ON public.note_restituzione
FOR EACH ROW EXECUTE FUNCTION public.validate_nota_restituzione_stato();

-- Actually let me create a proper updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_note_restituzione_updated_at ON public.note_restituzione;
CREATE TRIGGER update_note_restituzione_updated_at
BEFORE UPDATE ON public.note_restituzione
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.note_restituzione ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all note_restituzione" ON public.note_restituzione FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select note_restituzione" ON public.note_restituzione FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own note_restituzione" ON public.note_restituzione FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own note_restituzione" ON public.note_restituzione FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own note_restituzione" ON public.note_restituzione FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Contabilita select note_restituzione" ON public.note_restituzione FOR SELECT USING (has_role(auth.uid(), 'contabilita'));

-- Tabella note_restituzione_dettaglio
CREATE TABLE public.note_restituzione_dettaglio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES note_restituzione(id) ON DELETE CASCADE,
  titolo_id uuid REFERENCES titoli(id),
  prodotto_id uuid REFERENCES prodotti(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.note_restituzione_dettaglio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all note_dettaglio" ON public.note_restituzione_dettaglio FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select note_dettaglio" ON public.note_restituzione_dettaglio FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own note_dettaglio" ON public.note_restituzione_dettaglio FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND nota_id IN (SELECT id FROM note_restituzione WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Ufficio insert own note_dettaglio" ON public.note_restituzione_dettaglio FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND nota_id IN (SELECT id FROM note_restituzione WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Ufficio delete own note_dettaglio" ON public.note_restituzione_dettaglio FOR DELETE USING (has_role(auth.uid(), 'ufficio') AND nota_id IN (SELECT id FROM note_restituzione WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Contabilita select note_dettaglio" ON public.note_restituzione_dettaglio FOR SELECT USING (has_role(auth.uid(), 'contabilita'));

-- Tabella spedizioni_cartacee
CREATE TABLE public.spedizioni_cartacee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid REFERENCES uffici(id),
  nota_id uuid REFERENCES note_restituzione(id),
  tipo_spedizione text NOT NULL DEFAULT 'singola',
  tracking_code text,
  corriere text,
  data_spedizione date NOT NULL DEFAULT CURRENT_DATE,
  stato text NOT NULL DEFAULT 'preparata',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_spedizione_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.tipo_spedizione NOT IN ('singola','multipla') THEN
    RAISE EXCEPTION 'Invalid tipo_spedizione: %', NEW.tipo_spedizione;
  END IF;
  IF NEW.stato NOT IN ('preparata','spedita','consegnata','problema') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_spedizione
BEFORE INSERT OR UPDATE ON public.spedizioni_cartacee
FOR EACH ROW EXECUTE FUNCTION public.validate_spedizione_tipo();

ALTER TABLE public.spedizioni_cartacee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all spedizioni" ON public.spedizioni_cartacee FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select spedizioni" ON public.spedizioni_cartacee FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own spedizioni" ON public.spedizioni_cartacee FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own spedizioni" ON public.spedizioni_cartacee FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own spedizioni" ON public.spedizioni_cartacee FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Contabilita select spedizioni" ON public.spedizioni_cartacee FOR SELECT USING (has_role(auth.uid(), 'contabilita'));
