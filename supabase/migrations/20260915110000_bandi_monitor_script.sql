-- Script di monitoraggio per Bandi partecipati (fase 3).
-- Una ricetta riusabile per bando: URL extra, pattern, classificazione documenti.

CREATE TABLE IF NOT EXISTS public.bandi_monitor_script (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bando_id uuid NOT NULL REFERENCES public.bandi_pubblici(id) ON DELETE CASCADE,
  versione int NOT NULL DEFAULT 1,
  motore text,
  source_url text,
  script_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attivo boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  last_ok_at timestamptz,
  errore text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bandi_monitor_script_bando_uidx
  ON public.bandi_monitor_script (bando_id);

CREATE INDEX IF NOT EXISTS bandi_monitor_script_attivo_idx
  ON public.bandi_monitor_script (attivo, last_used_at);

COMMENT ON TABLE public.bandi_monitor_script IS
  'Ricetta di crawl/monitoraggio per un bando partecipato (link extra + pattern).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bandi_monitor_script TO authenticated;
GRANT ALL ON public.bandi_monitor_script TO service_role;

ALTER TABLE public.bandi_monitor_script ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read bandi_monitor_script"
  ON public.bandi_monitor_script FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  );

CREATE POLICY "Staff write bandi_monitor_script"
  ON public.bandi_monitor_script FOR ALL TO authenticated
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

CREATE TRIGGER trg_bandi_monitor_script_updated
  BEFORE UPDATE ON public.bandi_monitor_script
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
