
-- Chat canali (conversazioni interne)
CREATE TABLE public.chat_canali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  tipo text NOT NULL DEFAULT 'diretto',
  creato_da uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ufficio_id uuid REFERENCES public.uffici(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for tipo
CREATE OR REPLACE FUNCTION public.validate_chat_canali_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo NOT IN ('diretto','gruppo','broadcast') THEN
    RAISE EXCEPTION 'Invalid tipo: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_chat_canali_tipo BEFORE INSERT OR UPDATE ON public.chat_canali
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_canali_tipo();

-- Chat canali membri
CREATE TABLE public.chat_canali_membri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canale_id uuid NOT NULL REFERENCES public.chat_canali(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ruolo_canale text NOT NULL DEFAULT 'membro',
  created_at timestamptz DEFAULT now(),
  UNIQUE(canale_id, user_id)
);

-- Chat messaggi interni
CREATE TABLE public.chat_messaggi_interni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canale_id uuid NOT NULL REFERENCES public.chat_canali(id) ON DELETE CASCADE,
  mittente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messaggio text NOT NULL,
  tipo_messaggio text NOT NULL DEFAULT 'testo',
  richiedi_conferma boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Chat conferme lettura
CREATE TABLE public.chat_conferme_lettura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  messaggio_id uuid NOT NULL REFERENCES public.chat_messaggi_interni(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  confermato boolean DEFAULT false,
  confermato_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(messaggio_id, user_id)
);

-- Security definer function to check channel membership
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _canale_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_canali_membri
    WHERE user_id = _user_id AND canale_id = _canale_id
  )
$$;

-- RLS on chat_canali
ALTER TABLE public.chat_canali ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see channels they belong to" ON public.chat_canali
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.chat_canali_membri WHERE canale_id = id AND user_id = auth.uid())
);

CREATE POLICY "Authenticated users can create channels" ON public.chat_canali
FOR INSERT TO authenticated
WITH CHECK (creato_da = auth.uid());

-- RLS on chat_canali_membri
ALTER TABLE public.chat_canali_membri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see members of their channels" ON public.chat_canali_membri
FOR SELECT TO authenticated
USING (public.is_channel_member(auth.uid(), canale_id));

CREATE POLICY "Channel creators can add members" ON public.chat_canali_membri
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_canali WHERE id = canale_id AND creato_da = auth.uid())
  OR user_id = auth.uid()
);

-- RLS on chat_messaggi_interni
ALTER TABLE public.chat_messaggi_interni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see messages in their channels" ON public.chat_messaggi_interni
FOR SELECT TO authenticated
USING (public.is_channel_member(auth.uid(), canale_id));

CREATE POLICY "Users can send messages in their channels" ON public.chat_messaggi_interni
FOR INSERT TO authenticated
WITH CHECK (mittente_id = auth.uid() AND public.is_channel_member(auth.uid(), canale_id));

-- RLS on chat_conferme_lettura
ALTER TABLE public.chat_conferme_lettura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own confirmations" ON public.chat_conferme_lettura
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin sees confirmations for own messages" ON public.chat_conferme_lettura
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.chat_messaggi_interni WHERE id = messaggio_id AND mittente_id = auth.uid())
);

CREATE POLICY "Users can confirm their own" ON public.chat_conferme_lettura
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own confirmation" ON public.chat_conferme_lettura
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
