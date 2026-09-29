
-- Gruppi Statistici
CREATE TABLE public.gruppi_statistici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gruppi_statistici ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all gruppi_statistici" ON public.gruppi_statistici FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select gruppi_statistici" ON public.gruppi_statistici FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select gruppi_statistici" ON public.gruppi_statistici FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Contabilita select gruppi_statistici" ON public.gruppi_statistici FOR SELECT TO public USING (has_role(auth.uid(), 'contabilita'::app_role));

-- Filiali
CREATE TABLE public.filiali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.filiali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all filiali" ON public.filiali FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select filiali" ON public.filiali FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select filiali" ON public.filiali FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));

-- Tipi Rinnovo
CREATE TABLE public.tipi_rinnovo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tipi_rinnovo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all tipi_rinnovo" ON public.tipi_rinnovo FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select tipi_rinnovo" ON public.tipi_rinnovo FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select tipi_rinnovo" ON public.tipi_rinnovo FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));

-- Gruppi Compagnia
CREATE TABLE public.gruppi_compagnia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gruppi_compagnia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all gruppi_compagnia" ON public.gruppi_compagnia FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select gruppi_compagnia" ON public.gruppi_compagnia FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select gruppi_compagnia" ON public.gruppi_compagnia FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));

-- Tipi Mandatario
CREATE TABLE public.tipi_mandatario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tipi_mandatario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all tipi_mandatario" ON public.tipi_mandatario FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select tipi_mandatario" ON public.tipi_mandatario FOR SELECT TO public USING (has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "CFO select tipi_mandatario" ON public.tipi_mandatario FOR SELECT TO public USING (has_role(auth.uid(), 'cfo'::app_role));
