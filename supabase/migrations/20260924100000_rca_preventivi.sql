-- Preventivi RCA preparati in CBnet (quotazione Assicurapp in un passo successivo).

CREATE TABLE IF NOT EXISTS public.rca_preventivi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_uid text,
  cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  veicolo_id uuid REFERENCES public.veicoli_polizza(id) ON DELETE SET NULL,
  targa text NOT NULL,
  prodotto_code text NOT NULL CHECK (prodotto_code IN ('rca_auto', 'rca_autocarri')),
  stato text NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza', 'pronto', 'in_quotazione', 'quotato', 'salvato')),
  insurance_type text NOT NULL DEFAULT 'continuita_assicurativa',
  driving_type text NOT NULL DEFAULT 'Esperta',
  fractionation integer NOT NULL DEFAULT 1,
  garanzie_richieste text[] NOT NULL DEFAULT '{}',
  selected_cvts text[] NOT NULL DEFAULT '{}',
  bersani_plate text,
  bersani_cf text,
  client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  offerte_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rca_preventivi_targa_idx ON public.rca_preventivi (targa);
CREATE INDEX IF NOT EXISTS rca_preventivi_cliente_idx ON public.rca_preventivi (cliente_id);
CREATE INDEX IF NOT EXISTS rca_preventivi_created_at_idx ON public.rca_preventivi (created_at DESC);

DROP TRIGGER IF EXISTS trg_rca_preventivi_updated_at ON public.rca_preventivi;
CREATE TRIGGER trg_rca_preventivi_updated_at
  BEFORE UPDATE ON public.rca_preventivi
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rca_preventivi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage rca_preventivi" ON public.rca_preventivi;
CREATE POLICY "Staff can manage rca_preventivi"
  ON public.rca_preventivi FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.attivo, true)
        AND p.ruolo NOT IN ('cliente', 'prospect')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.attivo, true)
        AND p.ruolo NOT IN ('cliente', 'prospect')
    )
  );

REVOKE ALL ON public.rca_preventivi FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rca_preventivi TO authenticated;
GRANT ALL ON public.rca_preventivi TO service_role;

COMMENT ON TABLE public.rca_preventivi IS
  'Preventivi RCA CBnet (bozza/analisi). quote_uid e offerte si popolano con Assicurapp.';
