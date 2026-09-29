
-- Estinzione fields on titoli
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS data_estinzione date,
  ADD COLUMN IF NOT EXISTS causale_estinzione text,
  ADD COLUMN IF NOT EXISTS motivo_estinzione text,
  ADD COLUMN IF NOT EXISTS data_sostituzione date,
  ADD COLUMN IF NOT EXISTS causale_sostituzione text,
  ADD COLUMN IF NOT EXISTS motivo_sostituzione text;

-- Storico oggetto sostituito
CREATE TABLE IF NOT EXISTS public.titoli_sostituzioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  data_sostituzione date NOT NULL,
  causale text,
  motivo text,
  parametri_precedenti jsonb NOT NULL DEFAULT '{}'::jsonb,
  parametri_nuovi jsonb NOT NULL DEFAULT '{}'::jsonb,
  conguaglio numeric(12,2) DEFAULT 0,
  titolo_conguaglio_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_titoli_sostituzioni_titolo ON public.titoli_sostituzioni(titolo_id);

ALTER TABLE public.titoli_sostituzioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sostituzioni"
  ON public.titoli_sostituzioni FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sostituzioni"
  ON public.titoli_sostituzioni FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sostituzioni"
  ON public.titoli_sostituzioni FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete sostituzioni"
  ON public.titoli_sostituzioni FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')));
