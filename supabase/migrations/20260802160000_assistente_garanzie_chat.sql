-- Assistente Garanzie: conversazioni tecniche su CGA con condivisione team

CREATE TABLE public.garanzie_chat_conversazioni (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autore_email TEXT,
  titolo TEXT NOT NULL DEFAULT 'Nuova ricerca garanzie',
  condivisa BOOLEAN NOT NULL DEFAULT false,
  condivisa_at TIMESTAMPTZ,
  compagnia TEXT,
  ramo TEXT,
  prodotto_cga_id UUID REFERENCES public.prodotti_cga(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_garanzie_chat_conv_user ON public.garanzie_chat_conversazioni(user_id, updated_at DESC);
CREATE INDEX idx_garanzie_chat_conv_condivise ON public.garanzie_chat_conversazioni(condivisa, updated_at DESC)
  WHERE condivisa = true;

CREATE TABLE public.garanzie_chat_messaggi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversazione_id UUID NOT NULL REFERENCES public.garanzie_chat_conversazioni(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  fonti JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_garanzie_chat_msg_conv ON public.garanzie_chat_messaggi(conversazione_id, created_at);

ALTER TABLE public.garanzie_chat_conversazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garanzie_chat_messaggi ENABLE ROW LEVEL SECURITY;

-- Conversazioni: proprie + condivise (anche anon consultazione)
CREATE POLICY "garanzie_conv_select_own_or_shared"
  ON public.garanzie_chat_conversazioni FOR SELECT
  TO authenticated, anon
  USING (auth.uid() = user_id OR condivisa = true);

CREATE POLICY "garanzie_conv_insert_own"
  ON public.garanzie_chat_conversazioni FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "garanzie_conv_update_own"
  ON public.garanzie_chat_conversazioni FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "garanzie_conv_delete_own"
  ON public.garanzie_chat_conversazioni FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Messaggi: visibili se conversazione accessibile
CREATE POLICY "garanzie_msg_select"
  ON public.garanzie_chat_messaggi FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.garanzie_chat_conversazioni c
      WHERE c.id = conversazione_id
        AND (c.user_id = auth.uid() OR c.condivisa = true)
    )
  );

CREATE POLICY "garanzie_msg_insert_own_conv"
  ON public.garanzie_chat_messaggi FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.garanzie_chat_conversazioni c
      WHERE c.id = conversazione_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "garanzie_msg_delete_own_conv"
  ON public.garanzie_chat_messaggi FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garanzie_chat_conversazioni c
      WHERE c.id = conversazione_id AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_garanzie_chat_conv_updated
  BEFORE UPDATE ON public.garanzie_chat_conversazioni
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garanzie_chat_conversazioni TO authenticated;
GRANT SELECT ON public.garanzie_chat_conversazioni TO anon;
GRANT SELECT, INSERT, DELETE ON public.garanzie_chat_messaggi TO authenticated;
GRANT SELECT ON public.garanzie_chat_messaggi TO anon;

COMMENT ON TABLE public.garanzie_chat_conversazioni IS
  'Conversazioni Assistente Garanzie (Libreria CGA). condivisa=true visibile a tutto il team e area consultazione.';

-- Area consultazione: lettura catalogo CGA per filtri UI
CREATE POLICY "prodotti_cga_read_anon_consultazione"
  ON public.prodotti_cga FOR SELECT TO anon USING (true);

CREATE POLICY "prodotti_garanzie_read_anon_consultazione"
  ON public.prodotti_garanzie FOR SELECT TO anon USING (true);

CREATE POLICY "prodotti_condizioni_read_anon_consultazione"
  ON public.prodotti_condizioni FOR SELECT TO anon USING (true);

GRANT SELECT ON public.prodotti_cga TO anon;
GRANT SELECT ON public.prodotti_garanzie TO anon;
GRANT SELECT ON public.prodotti_condizioni TO anon;
