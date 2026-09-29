-- Nuova tabella provvigioni a livello Compagnia + Ramo (categoria)
CREATE TABLE public.provvigioni_compagnia_ramo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid NOT NULL REFERENCES public.compagnie(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorie_prodotto(id) ON DELETE CASCADE,
  percentuale_provvigione numeric NOT NULL DEFAULT 0,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(compagnia_id, categoria_id)
);

-- RLS
ALTER TABLE public.provvigioni_compagnia_ramo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read provvigioni_compagnia_ramo"
  ON public.provvigioni_compagnia_ramo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert provvigioni_compagnia_ramo"
  ON public.provvigioni_compagnia_ramo FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update provvigioni_compagnia_ramo"
  ON public.provvigioni_compagnia_ramo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete provvigioni_compagnia_ramo"
  ON public.provvigioni_compagnia_ramo FOR DELETE TO authenticated USING (true);