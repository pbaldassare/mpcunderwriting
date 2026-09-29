
-- Create document_folders table
CREATE TABLE public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  folder_type TEXT NOT NULL DEFAULT 'generale',
  description TEXT,
  icon TEXT DEFAULT '📁',
  parent_folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  compagnia_id UUID REFERENCES public.compagnie(id) ON DELETE SET NULL,
  order_index INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create document_library table
CREATE TABLE public.document_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Validation trigger for folder_type
CREATE OR REPLACE FUNCTION public.validate_document_folder_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.folder_type NOT IN ('compagnia','prodotto','sottoprodotto','generale') THEN
    RAISE EXCEPTION 'Invalid folder_type: %', NEW.folder_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_document_folder_type
  BEFORE INSERT OR UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.validate_document_folder_type();

-- RLS on document_folders
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folders"
  ON public.document_folders FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage folders"
  ON public.document_folders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS on document_library
ALTER TABLE public.document_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents"
  ON public.document_library FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage documents"
  ON public.document_library FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('document-library', 'document-library', false);

-- Storage RLS
CREATE POLICY "Authenticated users can read document-library"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'document-library');

CREATE POLICY "Admins can upload to document-library"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete from document-library"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'document-library' AND public.has_role(auth.uid(), 'admin'));

-- Seed initial folder structure from existing compagnie
INSERT INTO public.document_folders (name, folder_type, icon, compagnia_id, order_index)
SELECT nome, 'compagnia', '🏢', id, ROW_NUMBER() OVER (ORDER BY nome)
FROM public.compagnie WHERE attiva = true;

-- Seed subcategories for each compagnia folder
INSERT INTO public.document_folders (name, folder_type, icon, parent_folder_id, compagnia_id, order_index)
SELECT sub.name, 'sottoprodotto', sub.icon, df.id, df.compagnia_id, sub.idx
FROM public.document_folders df
CROSS JOIN (VALUES
  ('CGA - Condizioni Generali', '📋', 1),
  ('Condizioni di Polizza', '📄', 2),
  ('Fascicoli Informativi', '📑', 3),
  ('Modulistica', '📝', 4)
) AS sub(name, icon, idx)
WHERE df.folder_type = 'compagnia';

-- Seed general folders
INSERT INTO public.document_folders (name, folder_type, icon, order_index) VALUES
('Documenti Generali', 'generale', '📂', 1000);

INSERT INTO public.document_folders (name, folder_type, icon, parent_folder_id, order_index)
SELECT sub.name, 'generale', sub.icon, df.id, sub.idx
FROM public.document_folders df
CROSS JOIN (VALUES
  ('Privacy e Consensi', '🔒', 1),
  ('Normativa IVASS', '⚖️', 2),
  ('Circolari', '📨', 3)
) AS sub(name, icon, idx)
WHERE df.name = 'Documenti Generali' AND df.parent_folder_id IS NULL;
