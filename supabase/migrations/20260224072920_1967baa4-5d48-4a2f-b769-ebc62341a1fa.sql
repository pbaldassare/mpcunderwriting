
-- =============================================
-- 1) INDICI STRATEGICI
-- =============================================

-- TITOLI
CREATE INDEX IF NOT EXISTS idx_titoli_prodotto_id ON public.titoli(prodotto_id);
CREATE INDEX IF NOT EXISTS idx_titoli_cliente_id ON public.titoli(cliente_id);
CREATE INDEX IF NOT EXISTS idx_titoli_produttore_id ON public.titoli(produttore_id);
CREATE INDEX IF NOT EXISTS idx_titoli_ufficio_id ON public.titoli(ufficio_id);
CREATE INDEX IF NOT EXISTS idx_titoli_stato ON public.titoli(stato);
CREATE INDEX IF NOT EXISTS idx_titoli_data_incasso ON public.titoli(data_incasso);

-- PROVVIGIONI_GENERATE
CREATE INDEX IF NOT EXISTS idx_provvigioni_user_id ON public.provvigioni_generate(user_id);
CREATE INDEX IF NOT EXISTS idx_provvigioni_pagata ON public.provvigioni_generate(pagata);
CREATE INDEX IF NOT EXISTS idx_provvigioni_titolo_id ON public.provvigioni_generate(titolo_id);

-- SINISTRI
CREATE INDEX IF NOT EXISTS idx_sinistri_stato ON public.sinistri(stato);
CREATE INDEX IF NOT EXISTS idx_sinistri_responsabile_id ON public.sinistri(responsabile_id);
CREATE INDEX IF NOT EXISTS idx_sinistri_cliente_id ON public.sinistri(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sinistri_compagnia_id ON public.sinistri(compagnia_id);

-- MOVIMENTI_CONTABILI
CREATE INDEX IF NOT EXISTS idx_movimenti_ufficio_id ON public.movimenti_contabili(ufficio_id);
CREATE INDEX IF NOT EXISTS idx_movimenti_tipo ON public.movimenti_contabili(tipo);
CREATE INDEX IF NOT EXISTS idx_movimenti_data ON public.movimenti_contabili(data_movimento);

-- ESTRATTI_CONTO
CREATE INDEX IF NOT EXISTS idx_estratti_ufficio_id ON public.estratti_conto(ufficio_id);
CREATE INDEX IF NOT EXISTS idx_estratti_stato ON public.estratti_conto(stato);
CREATE INDEX IF NOT EXISTS idx_estratti_data ON public.estratti_conto(data_operazione);

-- RIMESSA_PREMI
CREATE INDEX IF NOT EXISTS idx_rimessa_compagnia_id ON public.rimessa_premi(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_rimessa_stato ON public.rimessa_premi(stato);
CREATE INDEX IF NOT EXISTS idx_rimessa_data ON public.rimessa_premi(data_creazione);

-- PROSPECT
CREATE INDEX IF NOT EXISTS idx_prospect_stato ON public.prospect(stato);
CREATE INDEX IF NOT EXISTS idx_prospect_assegnato_a ON public.prospect(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_prospect_ufficio_id ON public.prospect(ufficio_id);

-- LOG_ATTIVITA (per future rotation)
CREATE INDEX IF NOT EXISTS idx_log_attivita_created_at ON public.log_attivita(created_at);
CREATE INDEX IF NOT EXISTS idx_log_attivita_user_id ON public.log_attivita(user_id);

-- =============================================
-- 2) MATERIALIZED VIEW CFO
-- =============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.cfo_kpi_aggregati AS
SELECT
  COALESCE(SUM(CASE WHEN t.stato = 'incassato' THEN t.importo_incassato ELSE 0 END), 0) AS totale_premi_incassati,
  COALESCE((SELECT SUM(importo_provvigione) FROM provvigioni_generate), 0) AS totale_provvigioni_generate,
  COALESCE((SELECT SUM(importo_provvigione) FROM provvigioni_generate WHERE pagata = true), 0) AS totale_provvigioni_pagate,
  COALESCE((SELECT SUM(importo) FROM movimenti_contabili WHERE tipo = 'entrata'), 0) AS totale_entrate,
  COALESCE((SELECT SUM(importo) FROM movimenti_contabili WHERE tipo = 'uscita'), 0) AS totale_uscite,
  COALESCE((SELECT SUM(importo) FROM movimenti_contabili WHERE tipo = 'entrata'), 0)
    - COALESCE((SELECT SUM(importo) FROM movimenti_contabili WHERE tipo = 'uscita'), 0) AS totale_saldo
FROM titoli t;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cfo_kpi_aggregati ON public.cfo_kpi_aggregati(totale_premi_incassati, totale_saldo);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_cfo_kpi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.cfo_kpi_aggregati;
END;
$$;

-- =============================================
-- 7) LOG ROTATION - struttura predisposta
-- =============================================

CREATE TABLE IF NOT EXISTS public.log_attivita_archivio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  azione text,
  entita_tipo text,
  entita_id uuid,
  dettagli_json jsonb,
  created_at timestamptz DEFAULT now(),
  archiviato_il timestamptz DEFAULT now()
);

ALTER TABLE public.log_attivita_archivio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select archived logs" ON public.log_attivita_archivio
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CFO select archived logs" ON public.log_attivita_archivio
  FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));

-- =============================================
-- 8) PREPARAZIONE FULL TEXT SEARCH (tsvector)
-- =============================================

-- Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_profiles_search ON public.profiles USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.profiles_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.cognome, '') || ' ' ||
    coalesce(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_search ON public.profiles;
CREATE TRIGGER trg_profiles_search
  BEFORE INSERT OR UPDATE OF nome, cognome, email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_search_trigger();

-- Titoli
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_titoli_search ON public.titoli USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.titoli_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.numero_titolo, '') || ' ' ||
    coalesce(NEW.note, '') || ' ' ||
    coalesce(NEW.stato, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_search ON public.titoli;
CREATE TRIGGER trg_titoli_search
  BEFORE INSERT OR UPDATE OF numero_titolo, note, stato ON public.titoli
  FOR EACH ROW EXECUTE FUNCTION public.titoli_search_trigger();

-- Sinistri
ALTER TABLE public.sinistri ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_sinistri_search ON public.sinistri USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.sinistri_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.numero_sinistro, '') || ' ' ||
    coalesce(NEW.descrizione, '') || ' ' ||
    coalesce(NEW.stato, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sinistri_search ON public.sinistri;
CREATE TRIGGER trg_sinistri_search
  BEFORE INSERT OR UPDATE OF numero_sinistro, descrizione, stato ON public.sinistri
  FOR EACH ROW EXECUTE FUNCTION public.sinistri_search_trigger();

-- Prospect
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_prospect_search ON public.prospect USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.prospect_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.cognome, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.telefono, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospect_search ON public.prospect;
CREATE TRIGGER trg_prospect_search
  BEFORE INSERT OR UPDATE OF nome, cognome, email, telefono ON public.prospect
  FOR EACH ROW EXECUTE FUNCTION public.prospect_search_trigger();
