-- Template sommario polizze per cliente (1:1).
-- Il file Word/PDF è il modello di riferimento; la stampa usa layout_key + layout_json.

CREATE TABLE public.clienti_template_sommario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clienti(id) ON DELETE CASCADE,
  layout_key TEXT NOT NULL DEFAULT 'standard',
  nome_file TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  layout_json JSONB NOT NULL DEFAULT '{
    "version": 1,
    "summaryColumns": ["compagnia", "prodotto", "numero_polizza", "scadenza", "frazionamento", "premio_lordo"],
    "includeNotaBene": true,
    "includeDettaglio": true,
    "includeCga": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT clienti_template_sommario_layout_chk CHECK (layout_key IN ('standard', 'varese'))
);

CREATE INDEX clienti_template_sommario_layout_idx
  ON public.clienti_template_sommario (layout_key);

COMMENT ON TABLE public.clienti_template_sommario IS
  'Modello sommario polizze del cliente: file Word di riferimento + layout di stampa.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clienti_template_sommario TO authenticated;
GRANT ALL ON public.clienti_template_sommario TO service_role;
ALTER TABLE public.clienti_template_sommario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read clienti_template_sommario"
  ON public.clienti_template_sommario FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ruolo IN ('cliente', 'prospect')
    )
  );

CREATE POLICY "Staff write clienti_template_sommario"
  ON public.clienti_template_sommario FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
  );

CREATE TRIGGER trg_clienti_template_sommario_updated
  BEFORE UPDATE ON public.clienti_template_sommario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_cliente_template_sommario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layout text;
  v_piva text;
BEGIN
  v_piva := regexp_replace(coalesce(NEW.partita_iva, ''), '\s', '', 'g');
  IF lower(trim(coalesce(NEW.ragione_sociale, ''))) = 'comune di varese'
     OR v_piva IN ('00441340122', '00441340121')
  THEN
    v_layout := 'varese';
  ELSE
    v_layout := 'standard';
  END IF;

  INSERT INTO public.clienti_template_sommario (cliente_id, layout_key)
  VALUES (NEW.id, v_layout)
  ON CONFLICT (cliente_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clienti_ensure_template_sommario ON public.clienti;
CREATE TRIGGER trg_clienti_ensure_template_sommario
  AFTER INSERT ON public.clienti
  FOR EACH ROW EXECUTE FUNCTION public.ensure_cliente_template_sommario();

INSERT INTO public.clienti_template_sommario (cliente_id, layout_key)
SELECT
  c.id,
  CASE
    WHEN lower(trim(coalesce(c.ragione_sociale, ''))) = 'comune di varese' THEN 'varese'
    WHEN regexp_replace(coalesce(c.partita_iva, ''), '\s', '', 'g') IN ('00441340122', '00441340121') THEN 'varese'
    ELSE 'standard'
  END
FROM public.clienti c
ON CONFLICT (cliente_id) DO NOTHING;

UPDATE public.clienti_template_sommario t
SET layout_key = 'varese'
WHERE t.cliente_id IN (
  SELECT id FROM public.clienti
  WHERE lower(trim(coalesce(ragione_sociale, ''))) = 'comune di varese'
     OR regexp_replace(coalesce(partita_iva, ''), '\s', '', 'g') IN ('00441340122', '00441340121')
);

-- Sostituzione file (upsert) sul bucket documenti_clienti
DROP POLICY IF EXISTS "Staff update documenti_clienti" ON storage.objects;
CREATE POLICY "Staff update documenti_clienti"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documenti_clienti'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'ufficio')
      OR public.has_role(auth.uid(), 'backoffice')
      OR public.has_role(auth.uid(), 'contabilita')
      OR public.has_role(auth.uid(), 'cfo')
      OR public.has_role(auth.uid(), 'produttore')
      OR public.has_role(auth.uid(), 'corrispondente')
    )
  )
  WITH CHECK (
    bucket_id = 'documenti_clienti'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'ufficio')
      OR public.has_role(auth.uid(), 'backoffice')
      OR public.has_role(auth.uid(), 'contabilita')
      OR public.has_role(auth.uid(), 'cfo')
      OR public.has_role(auth.uid(), 'produttore')
      OR public.has_role(auth.uid(), 'corrispondente')
    )
  );
