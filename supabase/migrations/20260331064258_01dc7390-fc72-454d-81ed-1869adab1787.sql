
-- 1. Lookup tables
CREATE TABLE public.lookup_risk_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.lookup_risk_type ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_risk_type_read" ON public.lookup_risk_type FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_risk_type_all_admin" ON public.lookup_risk_type FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lookup_tipo_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.lookup_tipo_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_tipo_documento_read" ON public.lookup_tipo_documento FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_tipo_documento_all_admin" ON public.lookup_tipo_documento FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lookup_conti_incasso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.lookup_conti_incasso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_conti_incasso_read" ON public.lookup_conti_incasso FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_conti_incasso_all_admin" ON public.lookup_conti_incasso FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. New columns on titoli
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS percentuale_riparto numeric,
  ADD COLUMN IF NOT EXISTS tipo_mandatario text,
  ADD COLUMN IF NOT EXISTS risk_type text,
  ADD COLUMN IF NOT EXISTS prodotto_nome text,
  ADD COLUMN IF NOT EXISTS comp_contabile date,
  ADD COLUMN IF NOT EXISTS comp_assicurativa date,
  ADD COLUMN IF NOT EXISTS tipo_incasso text,
  ADD COLUMN IF NOT EXISTS conto_incasso text,
  ADD COLUMN IF NOT EXISTS id_legacy integer,
  ADD COLUMN IF NOT EXISTS produttore_nome text,
  ADD COLUMN IF NOT EXISTS ae_nome text,
  ADD COLUMN IF NOT EXISTS filiale text;

-- 3. New columns on movimenti_polizza
ALTER TABLE public.movimenti_polizza
  ADD COLUMN IF NOT EXISTS tipo_documento text,
  ADD COLUMN IF NOT EXISTS premio_netto numeric,
  ADD COLUMN IF NOT EXISTS tasse numeric,
  ADD COLUMN IF NOT EXISTS provvigioni_attive numeric,
  ADD COLUMN IF NOT EXISTS provvigioni_passive numeric,
  ADD COLUMN IF NOT EXISTS stato_incasso text;

-- 4. Seed lookup_tipo_documento with initial values
INSERT INTO public.lookup_tipo_documento (codice, descrizione) VALUES
  ('PI', 'Prima Impostazione'),
  ('PQ', 'Polizza Quietanza'),
  ('AM', 'Appendice Modifica');
