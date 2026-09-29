-- Esiti ID Guard per cliente CBnet.
-- Tutti i clienti CBnet usano un unico client_id ID Guard (secret lato edge).
-- Cooldown 24h per riga (cliente + email/dominio). Nessuna chiamata automatica.

CREATE TABLE IF NOT EXISTS public.idguard_verifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('email', 'domain')),
  target text NOT NULL,
  target_norm text GENERATED ALWAYS AS (lower(target)) STORED,
  stato text NOT NULL DEFAULT 'in_corso' CHECK (stato IN ('in_corso', 'completata', 'errore')),
  chiamata_at timestamptz NOT NULL DEFAULT now(),
  prossima_verifica_at timestamptz NOT NULL,
  is_pwned boolean,
  mail_esposte integer,
  password_esposte integer,
  breach_count integer,
  explanation text,
  evento_id text,
  idguard_client_id text,
  result_json jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.idguard_verifiche
  ADD CONSTRAINT idguard_verifiche_cliente_tipo_target_key UNIQUE (cliente_id, tipo, target_norm);

CREATE UNIQUE INDEX IF NOT EXISTS idguard_verifiche_evento_id_uidx
  ON public.idguard_verifiche (evento_id)
  WHERE evento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idguard_verifiche_cliente_id_idx
  ON public.idguard_verifiche (cliente_id);

CREATE INDEX IF NOT EXISTS idguard_verifiche_target_idx
  ON public.idguard_verifiche (tipo, lower(target));

DROP TRIGGER IF EXISTS trg_idguard_verifiche_updated_at ON public.idguard_verifiche;
CREATE TRIGGER trg_idguard_verifiche_updated_at
  BEFORE UPDATE ON public.idguard_verifiche
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.idguard_verifiche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read idguard_verifiche" ON public.idguard_verifiche;
CREATE POLICY "Staff can read idguard_verifiche"
  ON public.idguard_verifiche FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.attivo, true)
        AND p.ruolo NOT IN ('cliente', 'prospect')
    )
  );

REVOKE ALL ON public.idguard_verifiche FROM PUBLIC;
GRANT SELECT ON public.idguard_verifiche TO authenticated;
GRANT ALL ON public.idguard_verifiche TO service_role;

COMMENT ON TABLE public.idguard_verifiche IS
  'Esiti verifica ID Guard (email/dominio). Un solo client_id partner per tutti i clienti CBnet. Scrittura solo da edge function.';
