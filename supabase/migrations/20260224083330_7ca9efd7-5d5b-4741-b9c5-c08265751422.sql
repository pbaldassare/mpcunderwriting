
-- Create bucket for bank documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_banca', 'documenti_banca', false);

-- Storage policies for documenti_banca
CREATE POLICY "Admin all documenti_banca" ON storage.objects FOR ALL
USING (bucket_id = 'documenti_banca' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "CFO select documenti_banca" ON storage.objects FOR SELECT
USING (bucket_id = 'documenti_banca' AND public.has_role(auth.uid(), 'cfo'::public.app_role));

CREATE POLICY "Contabilita all documenti_banca" ON storage.objects FOR ALL
USING (bucket_id = 'documenti_banca' AND public.has_role(auth.uid(), 'contabilita'::public.app_role));

CREATE POLICY "Ufficio own documenti_banca upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documenti_banca' AND public.has_role(auth.uid(), 'ufficio'::public.app_role));

CREATE POLICY "Ufficio own documenti_banca select" ON storage.objects FOR SELECT
USING (bucket_id = 'documenti_banca' AND public.has_role(auth.uid(), 'ufficio'::public.app_role));

-- Create banca_documenti table
CREATE TABLE public.banca_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid REFERENCES public.uffici(id),
  nome_file text NOT NULL,
  path_storage text NOT NULL,
  tipo_documento text NOT NULL,
  stato text NOT NULL DEFAULT 'caricato',
  error_message text,
  righe_estratte integer DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for stato
CREATE OR REPLACE FUNCTION public.validate_banca_documenti_stato()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stato NOT IN ('caricato','in_elaborazione','elaborato','errore') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_banca_documenti_stato
BEFORE INSERT OR UPDATE ON public.banca_documenti
FOR EACH ROW EXECUTE FUNCTION public.validate_banca_documenti_stato();

ALTER TABLE public.banca_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all banca_documenti" ON public.banca_documenti FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CFO select banca_documenti" ON public.banca_documenti FOR SELECT
USING (has_role(auth.uid(), 'cfo'::app_role));

CREATE POLICY "Contabilita all banca_documenti" ON public.banca_documenti FOR ALL
USING (has_role(auth.uid(), 'contabilita'::app_role));

CREATE POLICY "Ufficio insert own banca_documenti" ON public.banca_documenti FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

CREATE POLICY "Ufficio select own banca_documenti" ON public.banca_documenti FOR SELECT
USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

CREATE POLICY "Ufficio update own banca_documenti" ON public.banca_documenti FOR UPDATE
USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- Indexes on banca_documenti
CREATE INDEX idx_banca_doc_ufficio ON public.banca_documenti(ufficio_id);
CREATE INDEX idx_banca_doc_stato ON public.banca_documenti(stato);

-- Extend estratti_conto
ALTER TABLE public.estratti_conto ADD COLUMN IF NOT EXISTS documento_id uuid REFERENCES public.banca_documenti(id);
ALTER TABLE public.estratti_conto ADD COLUMN IF NOT EXISTS hash_riga text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estratti_hash_riga ON public.estratti_conto(hash_riga) WHERE hash_riga IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estratti_documento ON public.estratti_conto(documento_id);

-- Extend incroci_bancari
ALTER TABLE public.incroci_bancari ADD COLUMN IF NOT EXISTS matching_score numeric;
ALTER TABLE public.incroci_bancari ADD COLUMN IF NOT EXISTS matching_metodo text;
