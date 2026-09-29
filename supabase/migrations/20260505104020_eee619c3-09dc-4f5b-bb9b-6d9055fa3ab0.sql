
-- Drop old unique constraint that only considered titolo_id
DROP INDEX IF EXISTS public.uniq_rca_principale_per_titolo;
ALTER TABLE public.premi_garanzia_polizza DROP CONSTRAINT IF EXISTS uniq_rca_principale_per_titolo;
DROP INDEX IF EXISTS public.premi_garanzia_polizza_titolo_rca_unique;
DROP INDEX IF EXISTS public.idx_premi_garanzia_polizza_rca_principale;

-- 1. Columns
ALTER TABLE public.premi_garanzia_polizza
  ADD COLUMN IF NOT EXISTS tipo_premio text NOT NULL DEFAULT 'firma',
  ADD COLUMN IF NOT EXISTS quietanza_personalizzata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voce_origine_id uuid REFERENCES public.premi_garanzia_polizza(id) ON DELETE SET NULL;

ALTER TABLE public.premi_garanzia_polizza
  DROP CONSTRAINT IF EXISTS premi_garanzia_polizza_tipo_premio_check;
ALTER TABLE public.premi_garanzia_polizza
  ADD CONSTRAINT premi_garanzia_polizza_tipo_premio_check CHECK (tipo_premio IN ('firma','quietanza'));

-- 2. New unique index per (titolo_id, tipo_premio)
CREATE UNIQUE INDEX IF NOT EXISTS premi_garanzia_polizza_rca_principale_uniq
  ON public.premi_garanzia_polizza (titolo_id, tipo_premio)
  WHERE is_rca_principale = true;

CREATE INDEX IF NOT EXISTS idx_premi_garanzia_tipo_premio
  ON public.premi_garanzia_polizza (titolo_id, tipo_premio);

-- 3. Mirror function
CREATE OR REPLACE FUNCTION public.sync_quietanza_da_firma(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.premi_garanzia_polizza q
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND (q.voce_origine_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.premi_garanzia_polizza f
                        WHERE f.id = q.voce_origine_id AND f.tipo_premio = 'firma'));

  INSERT INTO public.premi_garanzia_polizza (
    titolo_id, garanzia, codice_garanzia, firma, aliquota_tasse_pct,
    is_rca_principale, imposta_provinciale, ssn, lordo_calcolato, ordine,
    tipo_premio, voce_origine_id, quietanza_personalizzata
  )
  SELECT
    f.titolo_id, f.garanzia, f.codice_garanzia, f.firma, f.aliquota_tasse_pct,
    f.is_rca_principale, f.imposta_provinciale, f.ssn, f.lordo_calcolato, f.ordine,
    'quietanza', f.id, false
  FROM public.premi_garanzia_polizza f
  WHERE f.titolo_id = p_titolo_id
    AND f.tipo_premio = 'firma'
    AND NOT EXISTS (
      SELECT 1 FROM public.premi_garanzia_polizza q
      WHERE q.tipo_premio = 'quietanza' AND q.voce_origine_id = f.id
    );

  UPDATE public.premi_garanzia_polizza q
  SET garanzia = f.garanzia,
      codice_garanzia = f.codice_garanzia,
      firma = f.firma,
      aliquota_tasse_pct = f.aliquota_tasse_pct,
      is_rca_principale = f.is_rca_principale,
      imposta_provinciale = f.imposta_provinciale,
      ssn = f.ssn,
      lordo_calcolato = f.lordo_calcolato,
      ordine = f.ordine
  FROM public.premi_garanzia_polizza f
  WHERE q.titolo_id = p_titolo_id
    AND q.tipo_premio = 'quietanza'
    AND q.quietanza_personalizzata = false
    AND q.voce_origine_id = f.id
    AND f.tipo_premio = 'firma';
END;
$$;

-- 4. Trigger
CREATE OR REPLACE FUNCTION public.trg_premi_garanzia_sync_quietanza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_titolo uuid; v_tipo text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_titolo := OLD.titolo_id; v_tipo := OLD.tipo_premio;
  ELSE
    v_titolo := NEW.titolo_id; v_tipo := NEW.tipo_premio;
  END IF;
  IF v_tipo <> 'firma' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  PERFORM public.sync_quietanza_da_firma(v_titolo);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS premi_garanzia_sync_quietanza ON public.premi_garanzia_polizza;
CREATE TRIGGER premi_garanzia_sync_quietanza
AFTER INSERT OR UPDATE OR DELETE ON public.premi_garanzia_polizza
FOR EACH ROW EXECUTE FUNCTION public.trg_premi_garanzia_sync_quietanza();

-- 5. Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT titolo_id FROM public.premi_garanzia_polizza WHERE tipo_premio = 'firma'
  LOOP
    PERFORM public.sync_quietanza_da_firma(r.titolo_id);
  END LOOP;
END$$;
