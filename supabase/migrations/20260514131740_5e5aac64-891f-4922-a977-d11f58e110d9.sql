-- Aggiungi colonne per conto mittente e PDF su rimessa_premi
ALTER TABLE public.rimessa_premi
  ADD COLUMN IF NOT EXISTS conto_bancario_mittente_id uuid REFERENCES public.conti_bancari(id),
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- Bucket storage per PDF rimesse (privato)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rimesse-pdf', 'rimesse-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage: lettura/scrittura per utenti autenticati
DROP POLICY IF EXISTS "Authenticated read rimesse pdf" ON storage.objects;
CREATE POLICY "Authenticated read rimesse pdf"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'rimesse-pdf');

DROP POLICY IF EXISTS "Authenticated write rimesse pdf" ON storage.objects;
CREATE POLICY "Authenticated write rimesse pdf"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'rimesse-pdf');

DROP POLICY IF EXISTS "Authenticated update rimesse pdf" ON storage.objects;
CREATE POLICY "Authenticated update rimesse pdf"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'rimesse-pdf');