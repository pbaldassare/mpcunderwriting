-- Distinte di spedizione originali alle compagnie/agenzie
-- (documenti di polizza e quietanza restituiti, un PDF per agenzia)

CREATE TABLE IF NOT EXISTS public.distinte_restituzione_originali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  compagnia_nome text NOT NULL,
  num_documenti integer NOT NULL DEFAULT 0,
  num_titoli integer NOT NULL DEFAULT 0,
  pdf_path text,
  bucket_name text NOT NULL DEFAULT 'documenti_generali',
  stato text NOT NULL DEFAULT 'salvata' CHECK (stato IN ('salvata', 'errore')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ufficio_id uuid REFERENCES public.uffici(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distinte_restituzione_originali_righe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distinta_id uuid NOT NULL REFERENCES public.distinte_restituzione_originali(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documenti(id) ON DELETE SET NULL,
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  cliente_id uuid,
  cliente_nome text,
  numero_titolo text,
  tipo_titolo text NOT NULL DEFAULT 'polizza',
  nome_file text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distinte_rest_orig_created
  ON public.distinte_restituzione_originali (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distinte_rest_orig_compagnia
  ON public.distinte_restituzione_originali (compagnia_id);
CREATE INDEX IF NOT EXISTS idx_distinte_rest_orig_righe_distinta
  ON public.distinte_restituzione_originali_righe (distinta_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_distinte_rest_orig_righe_doc
  ON public.distinte_restituzione_originali_righe (documento_id)
  WHERE documento_id IS NOT NULL;

ALTER TABLE public.distinte_restituzione_originali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distinte_restituzione_originali_righe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage distinte_restituzione_originali" ON public.distinte_restituzione_originali;
CREATE POLICY "Staff manage distinte_restituzione_originali"
  ON public.distinte_restituzione_originali FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff manage distinte_restituzione_originali_righe" ON public.distinte_restituzione_originali_righe;
CREATE POLICY "Staff manage distinte_restituzione_originali_righe"
  ON public.distinte_restituzione_originali_righe FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.distinte_restituzione_originali TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distinte_restituzione_originali_righe TO authenticated;
GRANT ALL ON public.distinte_restituzione_originali TO service_role;
GRANT ALL ON public.distinte_restituzione_originali_righe TO service_role;
