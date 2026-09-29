CREATE OR REPLACE FUNCTION public.get_canali_staff_with_meta(
  _user_id uuid,
  _ambito text,
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  nome text,
  tipo text,
  entita_tipo text,
  entita_id text,
  ambito text,
  visibile_cliente boolean,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH miei_canali AS (
    SELECT cm.canale_id, cm.ultimo_letto_at
    FROM public.chat_canali_membri cm
    WHERE cm.user_id = _user_id
  ),
  msg_meta AS (
    SELECT DISTINCT ON (m.canale_id)
      m.canale_id,
      m.created_at AS last_message_at,
      m.messaggio AS last_message_preview
    FROM public.chat_messaggi_interni m
    WHERE m.canale_id IN (SELECT canale_id FROM miei_canali)
    ORDER BY m.canale_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.canale_id, COUNT(*) AS unread_count
    FROM public.chat_messaggi_interni m
    JOIN miei_canali mc ON mc.canale_id = m.canale_id
    WHERE m.mittente_id <> _user_id
      AND m.created_at > COALESCE(mc.ultimo_letto_at, '1970-01-01'::timestamptz)
    GROUP BY m.canale_id
  )
  SELECT
    c.id,
    c.nome,
    c.tipo,
    c.entita_tipo,
    c.entita_id,
    c.ambito,
    c.visibile_cliente,
    c.created_at,
    mm.last_message_at,
    mm.last_message_preview,
    COALESCE(u.unread_count, 0) AS unread_count
  FROM public.chat_canali c
  JOIN miei_canali mc ON mc.canale_id = c.id
  LEFT JOIN msg_meta mm ON mm.canale_id = c.id
  LEFT JOIN unread u ON u.canale_id = c.id
  WHERE c.ambito = _ambito
  ORDER BY COALESCE(mm.last_message_at, c.created_at) DESC
  LIMIT _limit OFFSET _offset;
$$;
