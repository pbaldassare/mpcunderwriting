ALTER TABLE public.bandi_pubblici ADD COLUMN IF NOT EXISTS pdf_path text;
ALTER TABLE public.bandi_pubblici ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.bandi_pubblici ADD COLUMN IF NOT EXISTS ente_tipo text;