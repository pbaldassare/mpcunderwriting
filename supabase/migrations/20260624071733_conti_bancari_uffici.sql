-- N:N associazione conti Consulbrokers ↔ sedi (uffici)
-- Sostituisce il singolo ufficio_id opzionale (che equivaleva a "tutte le sedi" se null).

CREATE TABLE IF NOT EXISTS public.conti_bancari_uffici (
  conto_bancario_id uuid NOT NULL REFERENCES public.conti_bancari(id) ON DELETE CASCADE,
  ufficio_id uuid NOT NULL REFERENCES public.uffici(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conto_bancario_id, ufficio_id)
);

CREATE INDEX IF NOT EXISTS conti_bancari_uffici_ufficio_idx
  ON public.conti_bancari_uffici(ufficio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conti_bancari_uffici TO authenticated;
GRANT ALL ON public.conti_bancari_uffici TO service_role;

ALTER TABLE public.conti_bancari_uffici ENABLE ROW LEVEL SECURITY;

-- Lettura: stesso perimetro staff di conti_bancari
DROP POLICY IF EXISTS "Staff read conti_bancari_uffici" ON public.conti_bancari_uffici;
CREATE POLICY "Staff read conti_bancari_uffici"
  ON public.conti_bancari_uffici FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ufficio'::app_role)
    OR has_role(auth.uid(), 'contabilita'::app_role)
  );

DROP POLICY IF EXISTS "Admin/Responsabile manage conti_bancari_uffici" ON public.conti_bancari_uffici;
CREATE POLICY "Admin/Responsabile manage conti_bancari_uffici"
  ON public.conti_bancari_uffici FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'responsabile_sede')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'responsabile_sede')
    )
  );

-- 1) Migra ufficio_id esplicito
INSERT INTO public.conti_bancari_uffici (conto_bancario_id, ufficio_id)
SELECT cb.id, cb.ufficio_id
FROM public.conti_bancari cb
WHERE cb.ufficio_id IS NOT NULL
  AND cb.tipo IN ('incasso_clienti', 'provvigioni', 'generico')
ON CONFLICT (conto_bancario_id, ufficio_id) DO NOTHING;

-- 2) Conti Consul senza sede (ex "tutte le sedi"): associa a tutte le sedi attive
INSERT INTO public.conti_bancari_uffici (conto_bancario_id, ufficio_id)
SELECT cb.id, u.id
FROM public.conti_bancari cb
CROSS JOIN public.uffici u
WHERE cb.ufficio_id IS NULL
  AND cb.tipo IN ('incasso_clienti', 'provvigioni', 'generico')
  AND u.attivo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.conti_bancari_uffici j WHERE j.conto_bancario_id = cb.id
  )
ON CONFLICT (conto_bancario_id, ufficio_id) DO NOTHING;

-- Depreca colonna legacy (mantenuta per compatibilità letture storiche)
COMMENT ON COLUMN public.conti_bancari.ufficio_id IS
  'DEPRECATED: usare conti_bancari_uffici per sedi abilitate (N:N). Non più scritta dalla UI.';

-- Sync opzionale: primo ufficio associato → ufficio_id legacy (solo lettura backward-compat)
CREATE OR REPLACE FUNCTION public.sync_conto_bancario_ufficio_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first uuid;
BEGIN
  SELECT ufficio_id INTO v_first
  FROM public.conti_bancari_uffici
  WHERE conto_bancario_id = COALESCE(NEW.conto_bancario_id, OLD.conto_bancario_id)
  ORDER BY created_at, ufficio_id
  LIMIT 1;

  UPDATE public.conti_bancari
  SET ufficio_id = v_first
  WHERE id = COALESCE(NEW.conto_bancario_id, OLD.conto_bancario_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conto_bancario_ufficio_legacy ON public.conti_bancari_uffici;
CREATE TRIGGER trg_sync_conto_bancario_ufficio_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.conti_bancari_uffici
  FOR EACH ROW EXECUTE FUNCTION public.sync_conto_bancario_ufficio_legacy();

-- Vincolo: conti Consulbrokers devono avere almeno una sede abilitata
CREATE OR REPLACE FUNCTION public.enforce_conto_consul_min_sedi()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_conto_id uuid;
  v_tipo text;
  v_count int;
BEGIN
  v_conto_id := COALESCE(NEW.conto_bancario_id, OLD.conto_bancario_id);
  SELECT tipo INTO v_tipo FROM public.conti_bancari WHERE id = v_conto_id;
  IF v_tipo IS NULL OR v_tipo NOT IN ('incasso_clienti', 'provvigioni', 'generico') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.conti_bancari_uffici
  WHERE conto_bancario_id = v_conto_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'I conti Consulbrokers devono avere almeno una sede abilitata.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_conto_consul_min_sedi ON public.conti_bancari_uffici;
CREATE CONSTRAINT TRIGGER trg_enforce_conto_consul_min_sedi
  AFTER INSERT OR UPDATE OR DELETE ON public.conti_bancari_uffici
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conto_consul_min_sedi();
