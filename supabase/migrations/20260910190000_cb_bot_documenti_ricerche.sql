-- CB Bot: ricerche salvate (restano all'azzeramento cronologia)
-- + libreria documenti analizzati e confronti.

ALTER TABLE public.garanzie_chat_conversazioni
  ADD COLUMN IF NOT EXISTS salvata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salvata_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_garanzie_chat_conv_salvata
  ON public.garanzie_chat_conversazioni (user_id, tipo, salvata, salvata_at DESC)
  WHERE salvata = true;

CREATE INDEX IF NOT EXISTS idx_garanzie_chat_conv_salvata_email
  ON public.garanzie_chat_conversazioni (lower(trim(autore_email)), tipo, salvata)
  WHERE salvata = true AND user_id IS NULL;

-- Admin vede tutte le conversazioni (archivio ricerche)
DROP POLICY IF EXISTS "garanzie_conv_select_admin" ON public.garanzie_chat_conversazioni;
CREATE POLICY "garanzie_conv_select_admin"
  ON public.garanzie_chat_conversazioni FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "garanzie_msg_select_admin" ON public.garanzie_chat_messaggi;
CREATE POLICY "garanzie_msg_select_admin"
  ON public.garanzie_chat_messaggi FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.garanzie_chat_salva_consultazione(
  p_email text,
  p_conversazione_id uuid,
  p_salvata boolean
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
    salvata = p_salvata,
    salvata_at = CASE WHEN p_salvata THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_conversazione_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garanzie_chat_azzera_cronologia_consultazione(
  p_email text,
  p_tipo text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.is_consultazione_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email non autorizzata';
  END IF;
  DELETE FROM public.garanzie_chat_conversazioni c
  WHERE c.user_id IS NULL
    AND lower(trim(c.autore_email)) = lower(trim(p_email))
    AND c.tipo = p_tipo
    AND c.salvata = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.garanzie_chat_salva_consultazione(text, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garanzie_chat_azzera_cronologia_consultazione(text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.garanzie_chat_salva_consultazione IS
  'Segna una ricerca consultazione come salvata: sopravvive ad azzera cronologia.';
COMMENT ON FUNCTION public.garanzie_chat_azzera_cronologia_consultazione IS
  'Cancella le ricerche non salvate della email in consultazione. Le salvate restano.';

-- Libreria documenti CB Bot
CREATE TABLE IF NOT EXISTS public.cb_bot_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  testo_estratto text,
  analisi text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cb_bot_documenti_created
  ON public.cb_bot_documenti (created_at DESC);

CREATE TABLE IF NOT EXISTS public.cb_bot_confronti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  documento_ids uuid[] NOT NULL DEFAULT '{}',
  risultato text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cb_bot_confronti_created
  ON public.cb_bot_confronti (created_at DESC);

ALTER TABLE public.cb_bot_documenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_bot_confronti ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_bot_documenti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_bot_confronti TO authenticated;
GRANT ALL ON public.cb_bot_documenti TO service_role;
GRANT ALL ON public.cb_bot_confronti TO service_role;

CREATE POLICY "Staff can read cb_bot_documenti"
  ON public.cb_bot_documenti FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can insert cb_bot_documenti"
  ON public.cb_bot_documenti FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can update cb_bot_documenti"
  ON public.cb_bot_documenti FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can delete cb_bot_documenti"
  ON public.cb_bot_documenti FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Staff can read cb_bot_confronti"
  ON public.cb_bot_confronti FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can insert cb_bot_confronti"
  ON public.cb_bot_confronti FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can delete cb_bot_confronti"
  ON public.cb_bot_confronti FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS set_updated_at_cb_bot_documenti ON public.cb_bot_documenti;
CREATE TRIGGER set_updated_at_cb_bot_documenti
  BEFORE UPDATE ON public.cb_bot_documenti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cb-bot-documenti', 'cb-bot-documenti', false, 12582912)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff read cb-bot-documenti" ON storage.objects;
CREATE POLICY "Staff read cb-bot-documenti"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cb-bot-documenti'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

DROP POLICY IF EXISTS "Staff upload cb-bot-documenti" ON storage.objects;
CREATE POLICY "Staff upload cb-bot-documenti"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cb-bot-documenti'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

DROP POLICY IF EXISTS "Staff delete cb-bot-documenti" ON storage.objects;
CREATE POLICY "Staff delete cb-bot-documenti"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cb-bot-documenti'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
