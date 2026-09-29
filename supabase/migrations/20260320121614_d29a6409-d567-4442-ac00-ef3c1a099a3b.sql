
CREATE TABLE public.fornitori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE,
  nome text NOT NULL,
  indirizzo text,
  cap text,
  localita text,
  provincia text,
  nazione text DEFAULT 'IT',
  codice_fiscale text,
  partita_iva text,
  email text,
  pec text,
  ultima_fattura date,
  stato_soggetto boolean DEFAULT false,
  stato_cliente boolean DEFAULT false,
  stato_fornitore boolean DEFAULT true,
  attivo boolean DEFAULT true,
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fornitori ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin full access on fornitori"
ON public.fornitori FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','super_admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','super_admin'))
);

-- CFO/Contabilita: select only
CREATE POLICY "CFO and Contabilita select fornitori"
ON public.fornitori FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita'))
);

-- Ufficio users: CRUD own office
CREATE POLICY "Ufficio CRUD own fornitori"
ON public.fornitori FOR ALL TO authenticated
USING (
  ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
);

-- Trigger updated_at
CREATE TRIGGER set_fornitori_updated_at
  BEFORE UPDATE ON public.fornitori
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
