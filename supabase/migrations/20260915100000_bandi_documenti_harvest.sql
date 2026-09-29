-- Fascicolo documenti e log harvest per Bandi partecipati (fase 2).

CREATE TABLE IF NOT EXISTS public.bandi_harvest_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bando_id uuid NOT NULL REFERENCES public.bandi_pubblici(id) ON DELETE CASCADE,
  avviato_il timestamptz NOT NULL DEFAULT now(),
  concluso_il timestamptz,
  esito text NOT NULL DEFAULT 'ok',
  motore text,
  documenti_nuovi int NOT NULL DEFAULT 0,
  documenti_aggiornati int NOT NULL DEFAULT 0,
  novita_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  errore text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bandi_harvest_run_esito_chk CHECK (esito IN ('ok', 'parziale', 'errore'))
);

CREATE INDEX IF NOT EXISTS bandi_harvest_run_bando_idx
  ON public.bandi_harvest_run (bando_id, avviato_il DESC);

CREATE TABLE IF NOT EXISTS public.bandi_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bando_id uuid NOT NULL REFERENCES public.bandi_pubblici(id) ON DELETE CASCADE,
  harvest_run_id uuid REFERENCES public.bandi_harvest_run(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'bando',
  nome text,
  mime text,
  url_origine text,
  storage_path text,
  hash_sha256 text,
  stato text NOT NULL DEFAULT 'nuovo',
  visto_il timestamptz,
  scaricato_il timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bandi_documenti_tipo_chk CHECK (
    tipo IN ('bando', 'disciplinare', 'capitolato', 'chiarimento', 'esito', 'altro')
  ),
  CONSTRAINT bandi_documenti_stato_chk CHECK (
    stato IN ('nuovo', 'invariato', 'aggiornato', 'rimosso')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS bandi_documenti_url_uidx
  ON public.bandi_documenti (bando_id, url_origine)
  WHERE url_origine IS NOT NULL;

CREATE INDEX IF NOT EXISTS bandi_documenti_bando_idx
  ON public.bandi_documenti (bando_id, stato);

COMMENT ON TABLE public.bandi_harvest_run IS
  'Ogni passata di aggiornamento dal portale su un bando partecipato.';
COMMENT ON TABLE public.bandi_documenti IS
  'Fascicolo documenti del bando (N file, hash, novità).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bandi_harvest_run TO authenticated;
GRANT ALL ON public.bandi_harvest_run TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bandi_documenti TO authenticated;
GRANT ALL ON public.bandi_documenti TO service_role;

ALTER TABLE public.bandi_harvest_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bandi_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read bandi_harvest_run"
  ON public.bandi_harvest_run FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  );

CREATE POLICY "Staff write bandi_harvest_run"
  ON public.bandi_harvest_run FOR ALL TO authenticated
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

CREATE POLICY "Staff read bandi_documenti"
  ON public.bandi_documenti FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'produttore')
  );

CREATE POLICY "Staff write bandi_documenti"
  ON public.bandi_documenti FOR ALL TO authenticated
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

CREATE TRIGGER trg_bandi_documenti_updated
  BEFORE UPDATE ON public.bandi_documenti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.bandi_documenti (
  bando_id, tipo, nome, mime, url_origine, storage_path, stato, scaricato_il, visto_il
)
SELECT
  b.id,
  CASE WHEN COALESCE(b.tipo_avviso, '') = 'esito' OR COALESCE(b.aggiudicato, false) THEN 'esito' ELSE 'bando' END,
  COALESCE(split_part(b.pdf_path, '/', array_length(string_to_array(b.pdf_path, '/'), 1)), 'bando.pdf'),
  'application/pdf',
  b.pdf_url,
  b.pdf_path,
  'invariato',
  b.updated_at,
  b.updated_at
FROM public.bandi_pubblici b
WHERE b.pdf_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bandi_documenti d
    WHERE d.bando_id = b.id
      AND (
        (b.pdf_url IS NOT NULL AND d.url_origine = b.pdf_url)
        OR d.storage_path = b.pdf_path
      )
  );
