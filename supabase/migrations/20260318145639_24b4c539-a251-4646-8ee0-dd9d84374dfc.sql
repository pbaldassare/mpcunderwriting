
-- Tabella Gruppi Ramo
CREATE TABLE public.gruppi_ramo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gruppi_ramo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all gruppi_ramo" ON public.gruppi_ramo FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select gruppi_ramo" ON public.gruppi_ramo FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select gruppi_ramo" ON public.gruppi_ramo FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));

-- Tabella Rami
CREATE TABLE public.rami (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  gruppo_ramo_id uuid REFERENCES public.gruppi_ramo(id) ON DELETE SET NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rami ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all rami" ON public.rami FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select rami" ON public.rami FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select rami" ON public.rami FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Produttore select rami" ON public.rami FOR SELECT TO public USING (has_role(auth.uid(), 'produttore'::app_role));
CREATE POLICY "Contabilita select rami" ON public.rami FOR SELECT TO public USING (has_role(auth.uid(), 'contabilita'::app_role));
