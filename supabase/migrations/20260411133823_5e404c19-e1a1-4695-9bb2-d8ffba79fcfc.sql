
-- Add context columns to chat_canali
ALTER TABLE public.chat_canali
  ADD COLUMN IF NOT EXISTS ambito text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS entita_tipo text,
  ADD COLUMN IF NOT EXISTS entita_id text,
  ADD COLUMN IF NOT EXISTS visibile_cliente boolean NOT NULL DEFAULT false;

-- Validate ambito values
CREATE OR REPLACE FUNCTION public.validate_chat_canali_ambito()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.ambito NOT IN ('interno', 'contestuale') THEN
    RAISE EXCEPTION 'Invalid ambito: %', NEW.ambito;
  END IF;
  IF NEW.ambito = 'contestuale' AND NEW.entita_tipo IS NULL THEN
    RAISE EXCEPTION 'entita_tipo is required for contextual channels';
  END IF;
  IF NEW.entita_tipo IS NOT NULL AND NEW.entita_tipo NOT IN ('cliente', 'trattativa', 'titolo', 'sinistro', 'argomento') THEN
    RAISE EXCEPTION 'Invalid entita_tipo: %', NEW.entita_tipo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_chat_canali_ambito
  BEFORE INSERT OR UPDATE ON public.chat_canali
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_canali_ambito();

-- Index for fast lookup of contextual channels
CREATE INDEX IF NOT EXISTS idx_chat_canali_entita ON public.chat_canali(entita_tipo, entita_id) WHERE ambito = 'contestuale';

-- Update RLS: allow clients to see contextual channels where they are members
DROP POLICY IF EXISTS "Users see channels they belong to" ON public.chat_canali;

CREATE POLICY "Users see channels they belong to"
  ON public.chat_canali
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_canali_membri
      WHERE chat_canali_membri.canale_id = chat_canali.id
        AND chat_canali_membri.user_id = auth.uid()
    )
  );

-- Allow clients to insert contextual channels
DROP POLICY IF EXISTS "Authenticated users can create channels" ON public.chat_canali;

CREATE POLICY "Authenticated users can create channels"
  ON public.chat_canali
  FOR INSERT
  WITH CHECK (creato_da = auth.uid());

-- Allow clients to add themselves as members
DROP POLICY IF EXISTS "Channel creators can add members" ON public.chat_canali_membri;

CREATE POLICY "Channel creators can add members"
  ON public.chat_canali_membri
  FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.chat_canali
      WHERE chat_canali.id = chat_canali_membri.canale_id
        AND chat_canali.creato_da = auth.uid()
    ))
    OR user_id = auth.uid()
  );

-- Allow clients to send messages in channels they belong to
DROP POLICY IF EXISTS "Users can send messages in their channels" ON public.chat_messaggi_interni;

CREATE POLICY "Users can send messages in their channels"
  ON public.chat_messaggi_interni
  FOR INSERT
  WITH CHECK (
    mittente_id = auth.uid()
    AND is_channel_member(auth.uid(), canale_id)
  );

-- Keep existing SELECT policy for chat_messaggi_interni (already uses is_channel_member)
