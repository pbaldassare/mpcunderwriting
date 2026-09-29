-- Fonti pinate da ricerche CB Bot + flag in evidenza sulle conversazioni.

ALTER TABLE public.garanzie_chat_conversazioni
  ADD COLUMN IF NOT EXISTS in_evidenza boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_evidenza_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_garanzie_chat_conv_evidenza
  ON public.garanzie_chat_conversazioni (in_evidenza, in_evidenza_at DESC)
  WHERE in_evidenza = true;

CREATE TABLE IF NOT EXISTS public.cb_bot_fonti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  url text NOT NULL,
  snippet text,
  dominio text NOT NULL,
  origine text NOT NULL DEFAULT 'ricerca'
    CHECK (origine IN ('ricerca', 'manuale')),
  conversazione_id uuid REFERENCES public.garanzie_chat_conversazioni (id) ON DELETE SET NULL,
  messaggio_id uuid REFERENCES public.garanzie_chat_messaggi (id) ON DELETE SET NULL,
  salvata_da uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text,
  tags text[] NOT NULL DEFAULT '{}',
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cb_bot_fonti_url_key UNIQUE (url)
);

CREATE INDEX IF NOT EXISTS idx_cb_bot_fonti_attiva
  ON public.cb_bot_fonti (attiva, updated_at DESC)
  WHERE attiva = true;

CREATE INDEX IF NOT EXISTS idx_cb_bot_fonti_dominio
  ON public.cb_bot_fonti (dominio);

ALTER TABLE public.cb_bot_fonti ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_bot_fonti TO authenticated;
GRANT ALL ON public.cb_bot_fonti TO service_role;

CREATE POLICY "Staff can read cb_bot_fonti"
  ON public.cb_bot_fonti FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can insert cb_bot_fonti"
  ON public.cb_bot_fonti FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff can update cb_bot_fonti"
  ON public.cb_bot_fonti FOR UPDATE TO authenticated
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

CREATE POLICY "Staff can delete cb_bot_fonti"
  ON public.cb_bot_fonti FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

DROP TRIGGER IF EXISTS set_updated_at_cb_bot_fonti ON public.cb_bot_fonti;
CREATE TRIGGER set_updated_at_cb_bot_fonti
  BEFORE UPDATE ON public.cb_bot_fonti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.cb_bot_fonti IS
  'Pagine/URL pinate da Assistente Web; il bot le riusa come fonti interne.';
COMMENT ON COLUMN public.garanzie_chat_conversazioni.in_evidenza IS
  'Ricerca curata: in evidenza e fonti della chat promosse in cb_bot_fonti.';
