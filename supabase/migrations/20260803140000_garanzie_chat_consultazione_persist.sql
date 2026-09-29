-- Persistenza chat consultazione per email (senza auth Supabase)

ALTER TABLE public.garanzie_chat_conversazioni
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.garanzie_chat_conversazioni
  ADD CONSTRAINT garanzie_chat_conv_owner_check CHECK (
    user_id IS NOT NULL
    OR (user_id IS NULL AND autore_email IS NOT NULL AND length(trim(autore_email)) > 3)
  );

CREATE INDEX IF NOT EXISTS idx_garanzie_chat_conv_email_tipo
  ON public.garanzie_chat_conversazioni(lower(trim(autore_email)), tipo, updated_at DESC)
  WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_consultazione_email_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(split_part(p_email, '@', 2))) = ANY(ARRAY[
    'consulbrokers.it',
    'cbdigital.tech',
    'etisicura.it',
    'mpcunderwriting.it',
    'interfidi.net',
    'gbintermediazioni.it',
    'exebroker.it',
    'igbsrl.it',
    'probroker.it',
    'dibroker.it'
  ])
  AND position('@' in lower(trim(p_email))) > 1;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_assert_owner_consultazione(p_email text, p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.garanzie_chat_conversazioni c
    WHERE c.id = p_conv_id
      AND c.user_id IS NULL
      AND lower(trim(c.autore_email)) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Conversazione non trovata o non autorizzata';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_list_mie_consultazione(p_email text, p_tipo text)
RETURNS SETOF public.garanzie_chat_conversazioni
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  RETURN QUERY
  SELECT *
  FROM public.garanzie_chat_conversazioni c
  WHERE c.user_id IS NULL
    AND lower(trim(c.autore_email)) = lower(trim(p_email))
    AND c.tipo = p_tipo
  ORDER BY c.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_create_consultazione(
  p_email text,
  p_tipo text,
  p_titolo text,
  p_compagnia text DEFAULT NULL,
  p_ramo text DEFAULT NULL,
  p_prodotto_cga_id uuid DEFAULT NULL
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
  INSERT INTO public.garanzie_chat_conversazioni (
    user_id, autore_email, titolo, tipo, compagnia, ramo, prodotto_cga_id
  ) VALUES (
    NULL, lower(trim(p_email)), left(p_titolo, 80), p_tipo, p_compagnia, p_ramo, p_prodotto_cga_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_insert_msg_consultazione(
  p_email text,
  p_conversazione_id uuid,
  p_role text,
  p_content text,
  p_fonti jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);
  IF p_role NOT IN ('user', 'assistant') THEN
    RAISE EXCEPTION 'Ruolo non valido';
  END IF;
  INSERT INTO public.garanzie_chat_messaggi (conversazione_id, role, content, fonti)
  VALUES (p_conversazione_id, p_role, p_content, p_fonti)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_touch_consultazione(
  p_email text,
  p_conversazione_id uuid,
  p_titolo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);
  UPDATE public.garanzie_chat_conversazioni
  SET
    updated_at = now(),
    titolo = COALESCE(left(p_titolo, 80), titolo)
  WHERE id = p_conversazione_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_share_consultazione(
  p_email text,
  p_conversazione_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);
  UPDATE public.garanzie_chat_conversazioni
  SET condivisa = true, condivisa_at = now(), updated_at = now()
  WHERE id = p_conversazione_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_delete_consultazione(
  p_email text,
  p_conversazione_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);
  DELETE FROM public.garanzie_chat_conversazioni WHERE id = p_conversazione_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_list_messages_consultazione(
  p_email text,
  p_conversazione_id uuid
)
RETURNS SETOF public.garanzie_chat_messaggi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);
  RETURN QUERY
  SELECT m.*
  FROM public.garanzie_chat_messaggi m
  WHERE m.conversazione_id = p_conversazione_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_consultazione_email_allowed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_list_mie_consultazione(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_create_consultazione(text, text, text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_insert_msg_consultazione(text, uuid, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_touch_consultazione(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_share_consultazione(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_delete_consultazione(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_list_messages_consultazione(text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.garanzie_chat_list_mie_consultazione IS
  'Elenco conversazioni Assistente salvate in area consultazione (identificazione per email).';
