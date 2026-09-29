-- Registro invii richiesta quietanza alle agenzie

CREATE TABLE IF NOT EXISTS public.richieste_quietanza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  compagnia_nome text,
  destinatario_email text NOT NULL,
  oggetto text NOT NULL,
  corpo_html text,
  num_titoli integer NOT NULL DEFAULT 0,
  stato text NOT NULL DEFAULT 'inviato' CHECK (stato IN ('inviato', 'errore')),
  errore text,
  resend_id text,
  inviato_at timestamptz NOT NULL DEFAULT now(),
  inviato_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.richieste_quietanza_righe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  richiesta_id uuid NOT NULL REFERENCES public.richieste_quietanza(id) ON DELETE CASCADE,
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  numero_polizza text,
  ramo text,
  cliente_nome text,
  premio_lordo numeric,
  data_scadenza date,
  tacito_rinnovo boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_richieste_quietanza_inviato_at ON public.richieste_quietanza(inviato_at DESC);
CREATE INDEX IF NOT EXISTS idx_richieste_quietanza_compagnia ON public.richieste_quietanza(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_richieste_quietanza_righe_richiesta ON public.richieste_quietanza_righe(richiesta_id);
CREATE INDEX IF NOT EXISTS idx_richieste_quietanza_righe_titolo ON public.richieste_quietanza_righe(titolo_id);

ALTER TABLE public.richieste_quietanza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.richieste_quietanza_righe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage richieste_quietanza" ON public.richieste_quietanza;
CREATE POLICY "Staff manage richieste_quietanza"
  ON public.richieste_quietanza FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff manage richieste_quietanza_righe" ON public.richieste_quietanza_righe;
CREATE POLICY "Staff manage richieste_quietanza_righe"
  ON public.richieste_quietanza_righe FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.richieste_quietanza TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.richieste_quietanza_righe TO authenticated;
GRANT ALL ON public.richieste_quietanza TO service_role;
GRANT ALL ON public.richieste_quietanza_righe TO service_role;
