-- Indice ricercabile per E/C Agenzia archiviati (riferimento, clienti, polizze, MI)

CREATE TABLE IF NOT EXISTS public.ec_agenzia_archivio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL UNIQUE REFERENCES public.documenti(id) ON DELETE CASCADE,
  compagnia_id uuid NOT NULL REFERENCES public.compagnie(id),
  riferimento text NOT NULL,
  periodo_testo text,
  data_estratto_conto date,
  righe jsonb NOT NULL DEFAULT '[]'::jsonb,
  testo_ricerca text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ec_agenzia_archivio IS 'Metadati E/C agenzia per ricerca storico (riferimento progressivo, clienti, polizze)';
COMMENT ON COLUMN public.ec_agenzia_archivio.testo_ricerca IS 'Testo denormalizzato lowercase per ILIKE (riferimento, polizze, clienti, MI)';

CREATE INDEX IF NOT EXISTS idx_ec_agenzia_archivio_compagnia ON public.ec_agenzia_archivio (compagnia_id);
CREATE INDEX IF NOT EXISTS idx_ec_agenzia_archivio_riferimento ON public.ec_agenzia_archivio (riferimento);
CREATE INDEX IF NOT EXISTS idx_ec_agenzia_archivio_testo ON public.ec_agenzia_archivio (testo_ricerca text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_ec_agenzia_archivio_created ON public.ec_agenzia_archivio (created_at DESC);

ALTER TABLE public.ec_agenzia_archivio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access ec_agenzia_archivio"
  ON public.ec_agenzia_archivio
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cerca_ec_agenzia_storico(
  p_compagnia_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_riferimento text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_polizza text DEFAULT NULL,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(trim(p_q), '');
  v_rif text := NULLIF(trim(p_riferimento), '');
  v_cli text := NULLIF(lower(trim(p_cliente)), '');
  v_pol text := NULLIF(lower(trim(p_polizza)), '');
  v_has_meta_filter boolean;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non autenticato');
  END IF;

  v_has_meta_filter := v_rif IS NOT NULL OR v_cli IS NOT NULL OR v_pol IS NOT NULL;

  SELECT count(*) INTO v_total
  FROM public.documenti d
  LEFT JOIN public.ec_agenzia_archivio a ON a.documento_id = d.id
  WHERE d.categoria = 'EC Agenzia'
    AND (p_compagnia_id IS NULL OR d.entita_id = p_compagnia_id)
    AND (p_date_from IS NULL OR d.created_at::date >= p_date_from)
    AND (p_date_to IS NULL OR d.created_at::date <= p_date_to)
    AND (
      v_q IS NULL
      OR d.nome_file ILIKE '%' || v_q || '%'
      OR a.riferimento ILIKE '%' || v_q || '%'
      OR a.testo_ricerca ILIKE '%' || lower(v_q) || '%'
    )
    AND (v_rif IS NULL OR a.riferimento ILIKE '%' || v_rif || '%')
    AND (v_cli IS NULL OR a.testo_ricerca ILIKE '%' || v_cli || '%')
    AND (v_pol IS NULL OR a.testo_ricerca ILIKE '%' || v_pol || '%')
    AND (NOT v_has_meta_filter OR a.id IS NOT NULL);

  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      d.id AS documento_id,
      d.nome_file,
      d.path_storage,
      d.bucket_name,
      d.created_at,
      d.entita_id AS compagnia_id,
      a.riferimento,
      a.periodo_testo,
      a.data_estratto_conto,
      a.righe
    FROM public.documenti d
    LEFT JOIN public.ec_agenzia_archivio a ON a.documento_id = d.id
    WHERE d.categoria = 'EC Agenzia'
      AND (p_compagnia_id IS NULL OR d.entita_id = p_compagnia_id)
      AND (p_date_from IS NULL OR d.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR d.created_at::date <= p_date_to)
      AND (
        v_q IS NULL
        OR d.nome_file ILIKE '%' || v_q || '%'
        OR a.riferimento ILIKE '%' || v_q || '%'
        OR a.testo_ricerca ILIKE '%' || lower(v_q) || '%'
      )
      AND (v_rif IS NULL OR a.riferimento ILIKE '%' || v_rif || '%')
      AND (v_cli IS NULL OR a.testo_ricerca ILIKE '%' || v_cli || '%')
      AND (v_pol IS NULL OR a.testo_ricerca ILIKE '%' || v_pol || '%')
      AND (NOT v_has_meta_filter OR a.id IS NOT NULL)
    ORDER BY d.created_at DESC
    LIMIT greatest(p_limit, 1)
    OFFSET greatest(p_offset, 0)
  ) x;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerca_ec_agenzia_storico(uuid, date, date, text, text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerca_ec_agenzia_storico(uuid, date, date, text, text, text, text, int, int) TO service_role;
