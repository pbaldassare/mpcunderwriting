-- Add commission columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS percentuale_base numeric(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS percentuale_consulenza numeric(5,2);

-- Create documenti_utenti table
CREATE TABLE IF NOT EXISTS documenti_utenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nome_file text NOT NULL,
  path_storage text NOT NULL,
  categoria text NOT NULL DEFAULT 'altro',
  note text,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for categoria
CREATE OR REPLACE FUNCTION validate_documenti_utenti_categoria()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.categoria NOT IN ('carta_identita','mandato','visura','patente','altro') THEN
    RAISE EXCEPTION 'Invalid categoria: %', NEW.categoria;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_doc_utenti_cat
  BEFORE INSERT OR UPDATE ON documenti_utenti
  FOR EACH ROW EXECUTE FUNCTION validate_documenti_utenti_categoria();

-- RLS on documenti_utenti
ALTER TABLE documenti_utenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage documenti_utenti"
  ON documenti_utenti FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_utenti', 'documenti_utenti', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Auth users can upload to documenti_utenti"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documenti_utenti');

CREATE POLICY "Auth users can read documenti_utenti"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documenti_utenti');

CREATE POLICY "Auth users can delete from documenti_utenti"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documenti_utenti');