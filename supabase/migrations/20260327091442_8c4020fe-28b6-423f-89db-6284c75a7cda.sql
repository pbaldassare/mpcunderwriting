
-- Table: movimenti_polizza
CREATE TABLE public.movimenti_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  riga integer DEFAULT 0,
  appendice text DEFAULT '000',
  data_movimento date DEFAULT CURRENT_DATE,
  data_effetto date,
  data_scadenza date,
  data_rinnovo date,
  tipo_rinnovo text,
  descrizione text,
  valuta text DEFAULT 'EUR',
  premio numeric(12,2) DEFAULT 0,
  provvigioni numeric(12,2) DEFAULT 0,
  tipo text DEFAULT 'Polizza Base',
  incassato boolean DEFAULT false,
  data_copertura date,
  data_incasso date,
  stato text DEFAULT 'attivo',
  sostituisce_id uuid REFERENCES public.movimenti_polizza(id),
  sostituito_da_id uuid REFERENCES public.movimenti_polizza(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_movimenti_polizza_titolo ON public.movimenti_polizza(titolo_id);
CREATE INDEX idx_movimenti_polizza_ufficio ON public.movimenti_polizza(ufficio_id);

-- RLS
ALTER TABLE public.movimenti_polizza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on movimenti_polizza"
  ON public.movimenti_polizza FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ufficio select own movimenti_polizza"
  ON public.movimenti_polizza FOR SELECT
  TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id());

CREATE POLICY "Ufficio insert own movimenti_polizza"
  ON public.movimenti_polizza FOR INSERT
  TO authenticated
  WITH CHECK (ufficio_id = public.get_my_ufficio_id());

CREATE POLICY "Ufficio update own movimenti_polizza"
  ON public.movimenti_polizza FOR UPDATE
  TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id())
  WITH CHECK (ufficio_id = public.get_my_ufficio_id());

-- Trigger for updated_at
CREATE TRIGGER set_movimenti_polizza_updated_at
  BEFORE UPDATE ON public.movimenti_polizza
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
