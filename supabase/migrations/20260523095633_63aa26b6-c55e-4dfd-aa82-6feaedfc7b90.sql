
-- Storno fields on titoli
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS data_storno date,
  ADD COLUMN IF NOT EXISTS causale_storno text,
  ADD COLUMN IF NOT EXISTS motivo_storno text,
  ADD COLUMN IF NOT EXISTS titolo_storno_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

-- Storico storni
CREATE TABLE IF NOT EXISTS public.titoli_storni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  titolo_storno_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  data_storno date NOT NULL,
  causale text,
  motivo text,
  importo_rimborsato numeric(12,2) DEFAULT 0,
  era_messa_cassa boolean DEFAULT false,
  documento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_titoli_storni_titolo ON public.titoli_storni(titolo_id);
ALTER TABLE public.titoli_storni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view storni"
  ON public.titoli_storni FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert storni"
  ON public.titoli_storni FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update storni"
  ON public.titoli_storni FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete storni"
  ON public.titoli_storni FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')));

-- Storico regolazioni premio
CREATE TABLE IF NOT EXISTS public.titoli_regolazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_madre_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  titolo_regolazione_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  data_regolazione date NOT NULL,
  periodo_da date,
  periodo_a date,
  imponibile_consuntivo numeric(14,2),
  conguaglio_premio numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  documento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_titoli_regolazioni_madre ON public.titoli_regolazioni(titolo_madre_id);
ALTER TABLE public.titoli_regolazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view regolazioni"
  ON public.titoli_regolazioni FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert regolazioni"
  ON public.titoli_regolazioni FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update regolazioni"
  ON public.titoli_regolazioni FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete regolazioni"
  ON public.titoli_regolazioni FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')));
