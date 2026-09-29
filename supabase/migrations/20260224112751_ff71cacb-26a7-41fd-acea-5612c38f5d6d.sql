
-- ============================================
-- 1) MATERIALIZED VIEW cfo_kpi_mensili
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.cfo_kpi_mensili AS
SELECT
  TO_CHAR(COALESCE(t.data_incasso, mc.data_movimento, s.data_apertura, ec.data_operazione, '2000-01-01'::date), 'YYYY-MM') AS mese,
  COALESCE(t.ufficio_id, mc.ufficio_id, s.ufficio_id, ec.ufficio_id) AS ufficio_id,
  COALESCE(SUM(t.importo_incassato) FILTER (WHERE t.stato = 'incassato'), 0) AS premi_incassati,
  0::numeric AS provvigioni_generate,
  0::numeric AS provvigioni_pagate,
  COALESCE(SUM(mc.importo) FILTER (WHERE mc.tipo = 'entrata'), 0) AS entrate,
  COALESCE(SUM(mc.importo) FILTER (WHERE mc.tipo = 'uscita'), 0) AS uscite,
  COALESCE(SUM(mc.importo) FILTER (WHERE mc.tipo = 'entrata'), 0) - COALESCE(SUM(mc.importo) FILTER (WHERE mc.tipo = 'uscita'), 0) AS saldo,
  COUNT(ec.id) FILTER (WHERE ec.stato = 'ko') AS ko_banca,
  COUNT(s.id) FILTER (WHERE s.stato IN ('aperto','in_lavorazione','in_attesa_documenti')) AS sinistri_aperti
FROM generate_series('2024-01-01'::date, CURRENT_DATE, '1 month') AS gs(mese_date)
LEFT JOIN titoli t ON TO_CHAR(t.data_incasso, 'YYYY-MM') = TO_CHAR(gs.mese_date, 'YYYY-MM')
LEFT JOIN movimenti_contabili mc ON TO_CHAR(mc.data_movimento, 'YYYY-MM') = TO_CHAR(gs.mese_date, 'YYYY-MM')
LEFT JOIN sinistri s ON TO_CHAR(s.data_apertura, 'YYYY-MM') = TO_CHAR(gs.mese_date, 'YYYY-MM')
LEFT JOIN estratti_conto ec ON TO_CHAR(ec.data_operazione, 'YYYY-MM') = TO_CHAR(gs.mese_date, 'YYYY-MM')
GROUP BY 1, 2;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfo_kpi_mensili_unique ON public.cfo_kpi_mensili (mese, ufficio_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_cfo_kpi_mensili()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.cfo_kpi_mensili;
END;
$$;

-- ============================================
-- 2) FULL TEXT SEARCH - GIN INDEXES
-- ============================================
-- search_vector columns already exist on profiles, titoli, sinistri, prospect
-- Just add GIN indexes
CREATE INDEX IF NOT EXISTS idx_profiles_search_gin ON public.profiles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_titoli_search_gin ON public.titoli USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_sinistri_search_gin ON public.sinistri USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_prospect_search_gin ON public.prospect USING GIN (search_vector);

-- ============================================
-- 3) COMPOSITE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_titoli_ufficio_incasso ON public.titoli (ufficio_id, data_incasso);
CREATE INDEX IF NOT EXISTS idx_titoli_ufficio_stato ON public.titoli (ufficio_id, stato);
CREATE INDEX IF NOT EXISTS idx_movimenti_ufficio_data ON public.movimenti_contabili (ufficio_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_movimenti_ufficio_tipo_data ON public.movimenti_contabili (ufficio_id, tipo, data_movimento);
CREATE INDEX IF NOT EXISTS idx_sinistri_ufficio_stato ON public.sinistri (ufficio_id, stato);
CREATE INDEX IF NOT EXISTS idx_sinistri_resp_stato ON public.sinistri (responsabile_id, stato);
CREATE INDEX IF NOT EXISTS idx_estratti_ufficio_stato_data ON public.estratti_conto (ufficio_id, stato, data_operazione);

-- ============================================
-- 4) UPLOAD RATE LIMIT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.upload_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ora_riferimento timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  conteggio int NOT NULL DEFAULT 1,
  UNIQUE (user_id, ora_riferimento)
);

ALTER TABLE public.upload_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manage own rate limit"
  ON public.upload_rate_limit
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 5) PERFORMANCE LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.performance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  durata_ms int NOT NULL,
  dettagli_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert perf log"
  ON public.performance_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin select perf log"
  ON public.performance_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CFO select perf log"
  ON public.performance_log
  FOR SELECT
  USING (has_role(auth.uid(), 'cfo'::app_role));

-- ============================================
-- 6) MAINTENANCE FUNCTIONS
-- ============================================

-- Mark overdue sinistro events
CREATE OR REPLACE FUNCTION public.segna_eventi_sinistri_scaduti()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  UPDATE sinistro_eventi
  SET stato = 'scaduto'
  WHERE stato = 'attivo'
    AND data_scadenza < CURRENT_DATE;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN json_build_object('eventi_scaduti', cnt);
END;
$$;

-- Archive old notifications (> 90 days, already read)
CREATE OR REPLACE FUNCTION public.archivia_notifiche_vecchie()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  DELETE FROM notifiche
  WHERE letto = true
    AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN json_build_object('notifiche_archiviate', cnt);
END;
$$;
