-- Know-how CB Bot: Q&A curate, riusate senza nuova chiamata IA.

CREATE TABLE IF NOT EXISTS public.cb_bot_know_how (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('web', 'cga')),
  domanda text NOT NULL,
  domanda_norm text NOT NULL,
  risposta text NOT NULL,
  fonti jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversazione_id uuid REFERENCES public.garanzie_chat_conversazioni (id) ON DELETE SET NULL,
  messaggio_id uuid REFERENCES public.garanzie_chat_messaggi (id) ON DELETE SET NULL,
  salvata_da uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  attiva boolean NOT NULL DEFAULT true,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cb_bot_know_how_tipo_norm_key UNIQUE (tipo, domanda_norm)
);

CREATE INDEX IF NOT EXISTS idx_cb_bot_know_how_attiva
  ON public.cb_bot_know_how (tipo, attiva, updated_at DESC)
  WHERE attiva = true;

ALTER TABLE public.cb_bot_know_how ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_bot_know_how TO authenticated;
GRANT ALL ON public.cb_bot_know_how TO service_role;

CREATE POLICY "Staff can read cb_bot_know_how"
  ON public.cb_bot_know_how FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can insert cb_bot_know_how"
  ON public.cb_bot_know_how FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can update cb_bot_know_how"
  ON public.cb_bot_know_how FOR UPDATE TO authenticated
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

CREATE POLICY "Staff can delete cb_bot_know_how"
  ON public.cb_bot_know_how FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

DROP TRIGGER IF EXISTS set_updated_at_cb_bot_know_how ON public.cb_bot_know_how;
CREATE TRIGGER set_updated_at_cb_bot_know_how
  BEFORE UPDATE ON public.cb_bot_know_how
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.cb_bot_insert_know_how_consultazione(
  p_email text,
  p_tipo text,
  p_domanda text,
  p_domanda_norm text,
  p_risposta text,
  p_fonti jsonb,
  p_conversazione_id uuid,
  p_messaggio_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF p_tipo NOT IN ('web', 'cga') THEN
    RAISE EXCEPTION 'tipo non valido';
  END IF;
  PERFORM public.garanzie_chat_assert_owner_consultazione(p_email, p_conversazione_id);

  INSERT INTO public.cb_bot_know_how (
    tipo, domanda, domanda_norm, risposta, fonti,
    conversazione_id, messaggio_id
  ) VALUES (
    p_tipo, p_domanda, p_domanda_norm, p_risposta, COALESCE(p_fonti, '[]'::jsonb),
    p_conversazione_id, p_messaggio_id
  )
  ON CONFLICT (tipo, domanda_norm) DO UPDATE SET
    risposta = EXCLUDED.risposta,
    fonti = EXCLUDED.fonti,
    conversazione_id = EXCLUDED.conversazione_id,
    messaggio_id = EXCLUDED.messaggio_id,
    attiva = true,
    updated_at = now()
  RETURNING id INTO new_id;

  UPDATE public.garanzie_chat_conversazioni
  SET in_evidenza = true, in_evidenza_at = now()
  WHERE id = p_conversazione_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cb_bot_insert_know_how_consultazione(text, text, text, text, text, jsonb, uuid, uuid)
  TO anon, authenticated;

COMMENT ON TABLE public.cb_bot_know_how IS
  'Q&A pertinenti CB Bot riusate come know-how senza nuova chiamata IA.';
