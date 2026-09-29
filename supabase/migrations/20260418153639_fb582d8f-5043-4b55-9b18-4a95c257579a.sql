-- Conversazioni chat IA
CREATE TABLE public.ai_chat_conversazioni (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titolo TEXT NOT NULL DEFAULT 'Nuova conversazione',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_conv_user ON public.ai_chat_conversazioni(user_id, updated_at DESC);

ALTER TABLE public.ai_chat_conversazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own conv select" ON public.ai_chat_conversazioni
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own conv insert" ON public.ai_chat_conversazioni
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own conv update" ON public.ai_chat_conversazioni
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own conv delete" ON public.ai_chat_conversazioni
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_ai_chat_conv_updated
  BEFORE UPDATE ON public.ai_chat_conversazioni
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messaggi
CREATE TABLE public.ai_chat_messaggi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversazione_id UUID NOT NULL REFERENCES public.ai_chat_conversazioni(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_msg_conv ON public.ai_chat_messaggi(conversazione_id, created_at);

ALTER TABLE public.ai_chat_messaggi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own msg select" ON public.ai_chat_messaggi
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own msg insert" ON public.ai_chat_messaggi
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own msg delete" ON public.ai_chat_messaggi
  FOR DELETE USING (auth.uid() = user_id);

-- Validation trigger for role
CREATE OR REPLACE FUNCTION public.validate_ai_chat_role()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('user','assistant','tool','system') THEN
    RAISE EXCEPTION 'Invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_chat_msg_role
  BEFORE INSERT OR UPDATE ON public.ai_chat_messaggi
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_chat_role();