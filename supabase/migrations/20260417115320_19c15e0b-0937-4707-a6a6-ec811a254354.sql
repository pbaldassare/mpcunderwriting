
ALTER TABLE public.chat_canali_membri
ADD COLUMN IF NOT EXISTS ultimo_letto_at TIMESTAMPTZ DEFAULT '1970-01-01'::timestamptz;

CREATE OR REPLACE FUNCTION public.get_chat_unread_count(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(m.id), 0)
  FROM public.chat_canali_membri cm
  JOIN public.chat_messaggi_interni m ON m.canale_id = cm.canale_id
  WHERE cm.user_id = _user_id
    AND m.mittente_id <> _user_id
    AND m.created_at > COALESCE(cm.ultimo_letto_at, '1970-01-01'::timestamptz)
$$;

CREATE OR REPLACE FUNCTION public.mark_canale_as_read(_canale_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_canali_membri
  SET ultimo_letto_at = now()
  WHERE canale_id = _canale_id
    AND user_id = auth.uid();
$$;
