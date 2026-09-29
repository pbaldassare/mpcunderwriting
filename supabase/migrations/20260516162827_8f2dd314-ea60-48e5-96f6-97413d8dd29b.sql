
-- 1. Aggiungi colonne granulari a provvigioni_compagnia_ramo
ALTER TABLE public.provvigioni_compagnia_ramo
  ADD COLUMN IF NOT EXISTS gruppo_ramo_id uuid REFERENCES public.gruppi_ramo(id),
  ADD COLUMN IF NOT EXISTS ramo_id uuid REFERENCES public.rami(id);

-- Unique parziale per (rapporto, gruppo_ramo, ramo) sulle righe attive
DROP INDEX IF EXISTS provv_rapporto_gr_ramo_unique;
CREATE UNIQUE INDEX provv_rapporto_gr_ramo_unique
  ON public.provvigioni_compagnia_ramo (compagnia_rapporto_id, gruppo_ramo_id, ramo_id)
  NULLS NOT DISTINCT
  WHERE attiva = true AND gruppo_ramo_id IS NOT NULL;

-- 2. Backfill: prova a mappare categoria_id -> gruppo_ramo via match su nome
UPDATE public.provvigioni_compagnia_ramo p
SET gruppo_ramo_id = gr.id
FROM public.categorie_prodotto cp
JOIN public.gruppi_ramo gr
  ON UPPER(TRIM(gr.descrizione)) = UPPER(TRIM(cp.nome))
  OR UPPER(TRIM(gr.codice)) = UPPER(TRIM(cp.nome))
WHERE p.categoria_id = cp.id
  AND p.gruppo_ramo_id IS NULL;

-- 3. Tabella default per tipo rapporto
CREATE TABLE IF NOT EXISTS public.provvigioni_default_tipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_rapporto text NOT NULL,
  gruppo_ramo_id uuid REFERENCES public.gruppi_ramo(id),
  ramo_id uuid REFERENCES public.rami(id),
  percentuale numeric NOT NULL DEFAULT 0,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS provv_default_tipo_unique;
CREATE UNIQUE INDEX provv_default_tipo_unique
  ON public.provvigioni_default_tipo (tipo_rapporto, gruppo_ramo_id, ramo_id)
  NULLS NOT DISTINCT
  WHERE attiva = true;

ALTER TABLE public.provvigioni_default_tipo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read provvigioni_default_tipo" ON public.provvigioni_default_tipo;
CREATE POLICY "Authenticated read provvigioni_default_tipo"
  ON public.provvigioni_default_tipo FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write provvigioni_default_tipo" ON public.provvigioni_default_tipo;
CREATE POLICY "Authenticated write provvigioni_default_tipo"
  ON public.provvigioni_default_tipo FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_provv_default_tipo_updated ON public.provvigioni_default_tipo;
CREATE TRIGGER trg_provv_default_tipo_updated
  BEFORE UPDATE ON public.provvigioni_default_tipo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RPC risolutore percentuale
CREATE OR REPLACE FUNCTION public.risolvi_provvigione_compagnia(
  _rapporto_id uuid,
  _ramo_id uuid
) RETURNS TABLE (percentuale numeric, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gruppo_ramo_id uuid;
  v_tipo_rapporto text;
  v_perc numeric;
BEGIN
  SELECT gruppo_ramo_id INTO v_gruppo_ramo_id FROM public.rami WHERE id = _ramo_id;
  SELECT tipo_rapporto INTO v_tipo_rapporto FROM public.compagnia_rapporti WHERE id = _rapporto_id;

  -- 1. match esatto (rapporto, gruppo_ramo, ramo)
  SELECT percentuale_provvigione INTO v_perc
  FROM public.provvigioni_compagnia_ramo
  WHERE compagnia_rapporto_id = _rapporto_id
    AND gruppo_ramo_id = v_gruppo_ramo_id
    AND ramo_id = _ramo_id
    AND attiva = true
  LIMIT 1;
  IF v_perc IS NOT NULL THEN
    RETURN QUERY SELECT v_perc, 'esatto'::text; RETURN;
  END IF;

  -- 2. default ramo (rapporto, gruppo_ramo, NULL)
  SELECT percentuale_provvigione INTO v_perc
  FROM public.provvigioni_compagnia_ramo
  WHERE compagnia_rapporto_id = _rapporto_id
    AND gruppo_ramo_id = v_gruppo_ramo_id
    AND ramo_id IS NULL
    AND attiva = true
  LIMIT 1;
  IF v_perc IS NOT NULL THEN
    RETURN QUERY SELECT v_perc, 'default_ramo'::text; RETURN;
  END IF;

  -- 3. % globale del rapporto
  SELECT percentuale_provvigione INTO v_perc
  FROM public.compagnia_rapporti WHERE id = _rapporto_id;
  IF v_perc IS NOT NULL AND v_perc > 0 THEN
    RETURN QUERY SELECT v_perc, 'rapporto'::text; RETURN;
  END IF;

  -- 4. default per tipo rapporto
  SELECT percentuale INTO v_perc
  FROM public.provvigioni_default_tipo
  WHERE tipo_rapporto = v_tipo_rapporto
    AND gruppo_ramo_id = v_gruppo_ramo_id
    AND attiva = true
  ORDER BY ramo_id NULLS LAST
  LIMIT 1;
  IF v_perc IS NOT NULL THEN
    RETURN QUERY SELECT v_perc, 'default_tipo'::text; RETURN;
  END IF;

  RETURN QUERY SELECT 0::numeric, 'nessuno'::text;
END;
$$;
