-- Decisioni interne CBnet sui bandi (non confondere con bandi_pubblici.stato della gara).

CREATE TABLE public.bandi_interesse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bando_id UUID NOT NULL UNIQUE REFERENCES public.bandi_pubblici(id) ON DELETE CASCADE,
  esito TEXT NOT NULL,
  motivo TEXT,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  harvest_at TIMESTAMPTZ,
  harvest_note TEXT,
  deciso_da UUID,
  deciso_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bandi_interesse_esito_chk CHECK (
    esito IN ('non_partecipo', 'voglio_partecipare', 'in_trattativa')
  )
);

CREATE INDEX bandi_interesse_esito_idx ON public.bandi_interesse (esito);
CREATE INDEX bandi_interesse_deciso_idx ON public.bandi_interesse (deciso_il DESC);

COMMENT ON TABLE public.bandi_interesse IS
  'Esito commerciale sul bando: non partecipo / voglio partecipare / in trattativa. Lo stato gara resta su bandi_pubblici.stato.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bandi_interesse TO authenticated;
GRANT ALL ON public.bandi_interesse TO service_role;
ALTER TABLE public.bandi_interesse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read bandi_interesse"
  ON public.bandi_interesse FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  );

CREATE POLICY "Staff write bandi_interesse"
  ON public.bandi_interesse FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  );

CREATE TRIGGER trg_bandi_interesse_updated
  BEFORE UPDATE ON public.bandi_interesse
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
