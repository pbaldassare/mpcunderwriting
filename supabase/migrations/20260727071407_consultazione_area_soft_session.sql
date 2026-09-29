-- Area consultazione: sessione soft (solo email @consulbrokers.it + disclaimer).
-- Lettura anon del documentale (allineata al modello soft: nessuna auth Supabase).
-- Audit accessi e ricerche.

CREATE TABLE IF NOT EXISTS public.consultazione_accessi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  disclaimer_version text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultazione_ricerche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  query text NOT NULL,
  percorso text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultazione_accessi_email_created
  ON public.consultazione_accessi (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultazione_ricerche_email_created
  ON public.consultazione_ricerche (email, created_at DESC);

ALTER TABLE public.consultazione_accessi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultazione_ricerche ENABLE ROW LEVEL SECURITY;

-- Solo admin autenticati leggono l'audit
CREATE POLICY "Admin read consultazione_accessi"
  ON public.consultazione_accessi FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin read consultazione_ricerche"
  ON public.consultazione_ricerche FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_consultazione_accesso(
  p_email text,
  p_disclaimer_version text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '@consulbrokers\.it$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email non autorizzata');
  END IF;
  IF p_disclaimer_version IS NULL OR trim(p_disclaimer_version) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Disclaimer mancante');
  END IF;

  INSERT INTO public.consultazione_accessi (email, disclaimer_version, user_agent)
  VALUES (v_email, trim(p_disclaimer_version), NULLIF(trim(p_user_agent), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_consultazione_ricerca(
  p_email text,
  p_query text,
  p_percorso text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_query text := trim(p_query);
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '@consulbrokers\.it$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email non autorizzata');
  END IF;
  IF v_query IS NULL OR v_query = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Query vuota');
  END IF;

  INSERT INTO public.consultazione_ricerche (email, query, percorso)
  VALUES (v_email, left(v_query, 500), NULLIF(trim(p_percorso), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_consultazione_accesso(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_consultazione_ricerca(text, text, text) TO anon, authenticated;

-- Lettura documentale per area consultazione (anon)
DROP POLICY IF EXISTS "Anon consultazione can read folders" ON public.document_folders;
CREATE POLICY "Anon consultazione can read folders"
  ON public.document_folders FOR SELECT TO anon
  USING (active = true);

DROP POLICY IF EXISTS "Anon consultazione can read documents" ON public.document_library;
CREATE POLICY "Anon consultazione can read documents"
  ON public.document_library FOR SELECT TO anon
  USING (active = true);

-- Storage: anon può creare signed URL / leggere oggetti document-library
DROP POLICY IF EXISTS "Anon consultazione can read document-library" ON storage.objects;
CREATE POLICY "Anon consultazione can read document-library"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'document-library');
