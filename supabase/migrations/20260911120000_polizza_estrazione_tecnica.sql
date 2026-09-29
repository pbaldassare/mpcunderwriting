-- Scheda tecnica polizza (certificato): partite, somme, esclusi, esclusioni,
-- sottolimiti e calcolo premio. Figlie di polizza_cga (ON DELETE CASCADE).

ALTER TABLE public.polizza_cga
  ADD COLUMN IF NOT EXISTS forma_copertura text,
  ADD COLUMN IF NOT EXISTS forma_copertura_note text;

CREATE TABLE IF NOT EXISTS public.polizza_partite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  codice text,
  descrizione text NOT NULL,
  tipo_bene text NOT NULL DEFAULT 'altro'
    CHECK (tipo_bene IN (
      'fabbricato', 'contenuto', 'merci', 'macchinari',
      'ricorso_terzi', 'fermo', 'altro'
    )),
  ubicazione text,
  somma_assicurata numeric,
  valuta text NOT NULL DEFAULT 'EUR',
  forma_assicurazione text
    CHECK (forma_assicurazione IS NULL OR forma_assicurazione IN (
      'valore_intero', 'primo_rischio_assoluto', 'primo_rischio_relativo',
      'valore_a_nuovo', 'altro'
    )),
  percentuale_scoperto numeric,
  franchigia numeric,
  ordine integer,
  fonte_testo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (polizza_cga_id, numero)
);

CREATE TABLE IF NOT EXISTS public.polizza_beni_esclusi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  partita_id uuid REFERENCES public.polizza_partite(id) ON DELETE SET NULL,
  descrizione text NOT NULL,
  motivo text,
  fonte_testo text,
  ordine integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polizza_esclusioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  partita_id uuid REFERENCES public.polizza_partite(id) ON DELETE SET NULL,
  livello text NOT NULL DEFAULT 'generale'
    CHECK (livello IN ('generale', 'garanzia', 'partita')),
  garanzia text,
  articolo text,
  titolo text,
  testo text NOT NULL,
  rilevante_sinistri boolean NOT NULL DEFAULT true,
  fonte_testo text,
  ordine integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polizza_sottolimiti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  partita_id uuid REFERENCES public.polizza_partite(id) ON DELETE SET NULL,
  garanzia text,
  voce text NOT NULL,
  importo numeric,
  percentuale numeric,
  base_calcolo text
    CHECK (base_calcolo IS NULL OR base_calcolo IN (
      'somma_partita', 'massimale', 'danno', 'altro'
    )),
  per text
    CHECK (per IS NULL OR per IN ('sinistro', 'anno', 'ubicazione', 'persona')),
  franchigia numeric,
  scoperto_pct numeric,
  minimo numeric,
  massimo numeric,
  fonte_testo text,
  ordine integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polizza_premio_calcolo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  partita_id uuid REFERENCES public.polizza_partite(id) ON DELETE SET NULL,
  garanzia text,
  base_imponibile numeric,
  tasso numeric,
  tasso_unita text NOT NULL DEFAULT 'per_mille'
    CHECK (tasso_unita IN ('per_mille', 'percento')),
  premio_imponibile numeric,
  aliquota_imposte_pct numeric,
  imposte numeric,
  ssn numeric,
  premio_lordo numeric,
  tipo_rata text NOT NULL DEFAULT 'annuo'
    CHECK (tipo_rata IN ('annuo', 'sottoscrizione', 'successiva')),
  regolazione boolean NOT NULL DEFAULT false,
  parametro_regolazione text,
  premio_minimo numeric,
  formula_fonte text,
  ordine integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polizza_partite_cga ON public.polizza_partite(polizza_cga_id);
CREATE INDEX IF NOT EXISTS idx_polizza_beni_esclusi_cga ON public.polizza_beni_esclusi(polizza_cga_id);
CREATE INDEX IF NOT EXISTS idx_polizza_esclusioni_cga ON public.polizza_esclusioni(polizza_cga_id);
CREATE INDEX IF NOT EXISTS idx_polizza_sottolimiti_cga ON public.polizza_sottolimiti(polizza_cga_id);
CREATE INDEX IF NOT EXISTS idx_polizza_premio_calcolo_cga ON public.polizza_premio_calcolo(polizza_cga_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_partite TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_beni_esclusi TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_esclusioni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_sottolimiti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_premio_calcolo TO authenticated;
GRANT ALL ON public.polizza_partite TO service_role;
GRANT ALL ON public.polizza_beni_esclusi TO service_role;
GRANT ALL ON public.polizza_esclusioni TO service_role;
GRANT ALL ON public.polizza_sottolimiti TO service_role;
GRANT ALL ON public.polizza_premio_calcolo TO service_role;

ALTER TABLE public.polizza_partite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polizza_beni_esclusi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polizza_esclusioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polizza_sottolimiti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polizza_premio_calcolo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read polizza_partite via polizza_cga"
  ON public.polizza_partite FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write polizza_partite via polizza_cga"
  ON public.polizza_partite FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));

CREATE POLICY "Read polizza_beni_esclusi via polizza_cga"
  ON public.polizza_beni_esclusi FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write polizza_beni_esclusi via polizza_cga"
  ON public.polizza_beni_esclusi FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));

CREATE POLICY "Read polizza_esclusioni via polizza_cga"
  ON public.polizza_esclusioni FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write polizza_esclusioni via polizza_cga"
  ON public.polizza_esclusioni FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));

CREATE POLICY "Read polizza_sottolimiti via polizza_cga"
  ON public.polizza_sottolimiti FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write polizza_sottolimiti via polizza_cga"
  ON public.polizza_sottolimiti FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));

CREATE POLICY "Read polizza_premio_calcolo via polizza_cga"
  ON public.polizza_premio_calcolo FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write polizza_premio_calcolo via polizza_cga"
  ON public.polizza_premio_calcolo FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
