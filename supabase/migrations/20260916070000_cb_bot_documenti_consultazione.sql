-- Libreria documenti CB Bot anche in Area consultazione (email, senza auth gestionale).

ALTER TABLE public.cb_bot_documenti
  ADD COLUMN IF NOT EXISTS created_by_email text;

ALTER TABLE public.cb_bot_confronti
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE INDEX IF NOT EXISTS idx_cb_bot_documenti_email
  ON public.cb_bot_documenti (lower(trim(created_by_email)), created_at DESC)
  WHERE created_by_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cb_bot_confronti_email
  ON public.cb_bot_confronti (lower(trim(created_by_email)), created_at DESC)
  WHERE created_by_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cb_bot_consultazione_folder(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'c/' || coalesce(
    nullif(
      trim(both '_' from regexp_replace(lower(trim(p_email)), '[^a-z0-9]+', '_', 'g')),
      ''
    ),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION public.cb_bot_list_documenti_consultazione(p_email text)
RETURNS TABLE (
  id uuid,
  titolo text,
  file_name text,
  storage_path text,
  mime_type text,
  size_bytes integer,
  analisi text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  RETURN QUERY
  SELECT d.id, d.titolo, d.file_name, d.storage_path, d.mime_type, d.size_bytes, d.analisi, d.created_at
  FROM public.cb_bot_documenti d
  WHERE d.created_by IS NULL
    AND lower(trim(d.created_by_email)) = lower(trim(p_email))
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.cb_bot_list_confronti_consultazione(p_email text)
RETURNS TABLE (
  id uuid,
  titolo text,
  documento_ids uuid[],
  risultato text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  RETURN QUERY
  SELECT c.id, c.titolo, c.documento_ids, c.risultato, c.created_at
  FROM public.cb_bot_confronti c
  WHERE c.created_by IS NULL
    AND lower(trim(c.created_by_email)) = lower(trim(p_email))
  ORDER BY c.created_at DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.cb_bot_insert_documento_consultazione(
  p_email text,
  p_titolo text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_testo_estratto text,
  p_analisi text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_folder text;
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  v_folder := public.cb_bot_consultazione_folder(p_email);
  IF p_storage_path IS NULL
     OR p_storage_path NOT LIKE v_folder || '/%' THEN
    RAISE EXCEPTION 'Percorso file non autorizzato';
  END IF;
  INSERT INTO public.cb_bot_documenti (
    titolo, file_name, storage_path, mime_type, size_bytes,
    testo_estratto, analisi, created_by, created_by_email
  ) VALUES (
    left(trim(p_titolo), 160),
    left(trim(p_file_name), 240),
    p_storage_path,
    p_mime_type,
    p_size_bytes,
    p_testo_estratto,
    p_analisi,
    NULL,
    lower(trim(p_email))
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cb_bot_insert_confronto_consultazione(
  p_email text,
  p_titolo text,
  p_documento_ids uuid[],
  p_risultato text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  INSERT INTO public.cb_bot_confronti (
    titolo, documento_ids, risultato, created_by, created_by_email
  ) VALUES (
    left(coalesce(nullif(trim(p_titolo), ''), 'Confronto documenti'), 160),
    coalesce(p_documento_ids, '{}'),
    p_risultato,
    NULL,
    lower(trim(p_email))
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cb_bot_delete_documento_consultazione(
  p_email text,
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_path text;
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  SELECT storage_path INTO v_path
  FROM public.cb_bot_documenti
  WHERE id = p_id
    AND created_by IS NULL
    AND lower(trim(created_by_email)) = lower(trim(p_email));
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Documento non trovato';
  END IF;
  DELETE FROM public.cb_bot_documenti WHERE id = p_id;
  DELETE FROM storage.objects
  WHERE bucket_id = 'cb-bot-documenti' AND name = v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cb_bot_consultazione_folder(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cb_bot_list_documenti_consultazione(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cb_bot_list_confronti_consultazione(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cb_bot_insert_documento_consultazione(text, text, text, text, text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cb_bot_insert_confronto_consultazione(text, text, uuid[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cb_bot_delete_documento_consultazione(text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.cb_bot_list_documenti_consultazione IS
  'Elenco documenti CB Bot della sola email in Area consultazione.';
