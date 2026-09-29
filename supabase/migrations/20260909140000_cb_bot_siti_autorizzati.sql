-- Siti web da cui CB Bot / Assistente Web può interrogare (allowlist admin).
CREATE TABLE IF NOT EXISTS public.cb_bot_siti_autorizzati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL,
  dominio text NOT NULL,
  note text,
  attivo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cb_bot_siti_autorizzati_dominio_key UNIQUE (dominio)
);

CREATE INDEX IF NOT EXISTS idx_cb_bot_siti_autorizzati_attivo
  ON public.cb_bot_siti_autorizzati (attivo)
  WHERE attivo = true;

ALTER TABLE public.cb_bot_siti_autorizzati ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cb_bot_siti_autorizzati TO authenticated;
GRANT ALL ON public.cb_bot_siti_autorizzati TO service_role;

CREATE POLICY "Authenticated can read cb_bot_siti_autorizzati"
  ON public.cb_bot_siti_autorizzati FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert cb_bot_siti_autorizzati"
  ON public.cb_bot_siti_autorizzati FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update cb_bot_siti_autorizzati"
  ON public.cb_bot_siti_autorizzati FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete cb_bot_siti_autorizzati"
  ON public.cb_bot_siti_autorizzati FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS set_updated_at_cb_bot_siti_autorizzati ON public.cb_bot_siti_autorizzati;
CREATE TRIGGER set_updated_at_cb_bot_siti_autorizzati
  BEFORE UPDATE ON public.cb_bot_siti_autorizzati
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cb_bot_siti_autorizzati (nome, url, dominio, note) VALUES
  ('IVASS', 'https://www.ivass.it', 'ivass.it', 'Istituto per la vigilanza sulle assicurazioni'),
  ('ANIA', 'https://www.ania.it', 'ania.it', 'Associazione Nazionale fra le Imprese Assicuratrici'),
  ('Normattiva', 'https://www.normattiva.it', 'normattiva.it', 'Normativa italiana vigente')
ON CONFLICT (dominio) DO NOTHING;
