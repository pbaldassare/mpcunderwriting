
CREATE TABLE public.compagnia_rapporto_documenti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rapporto_id UUID NOT NULL REFERENCES public.compagnia_rapporti(id) ON DELETE CASCADE,
  nome_file TEXT NOT NULL,
  file_path TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'altro',
  dimensione_bytes BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compagnia_rapporto_documenti_rapporto ON public.compagnia_rapporto_documenti(rapporto_id);

ALTER TABLE public.compagnia_rapporto_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rapporto documenti"
  ON public.compagnia_rapporto_documenti FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert rapporto documenti"
  ON public.compagnia_rapporto_documenti FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update rapporto documenti"
  ON public.compagnia_rapporto_documenti FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete rapporto documenti"
  ON public.compagnia_rapporto_documenti FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_crd_updated_at
  BEFORE UPDATE ON public.compagnia_rapporto_documenti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
