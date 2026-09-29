
-- =====================================================
-- Espansione tabella titoli con campi legacy polizza
-- =====================================================

-- Sezione CONTRATTO
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS compagnia_id uuid REFERENCES public.compagnie(id),
  ADD COLUMN IF NOT EXISTS ramo_id uuid REFERENCES public.rami(id),
  ADD COLUMN IF NOT EXISTS gruppo_ramo text,
  ADD COLUMN IF NOT EXISTS specialist text,
  ADD COLUMN IF NOT EXISTS tipo_portafoglio text,
  ADD COLUMN IF NOT EXISTS cig_rif text,
  ADD COLUMN IF NOT EXISTS vincolo text,
  ADD COLUMN IF NOT EXISTS descrizione_polizza text,
  ADD COLUMN IF NOT EXISTS appendice text,
  ADD COLUMN IF NOT EXISTS riga integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS targa_telaio text;

-- Sezione PERIODO
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS durata_da date,
  ADD COLUMN IF NOT EXISTS durata_a date,
  ADD COLUMN IF NOT EXISTS anni_durata integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS garanzia_da date,
  ADD COLUMN IF NOT EXISTS garanzia_a date,
  ADD COLUMN IF NOT EXISTS data_competenza date,
  ADD COLUMN IF NOT EXISTS limite_mora date,
  ADD COLUMN IF NOT EXISTS mora_giorni integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS rate integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tipo_rinnovo text DEFAULT 'tacito_rinnovo',
  ADD COLUMN IF NOT EXISTS disdetta_mesi integer DEFAULT 2;

-- Sezione REGOLAZIONE
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS regolazione boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_lettera_regolazione text,
  ADD COLUMN IF NOT EXISTS tipo_scadenza text,
  ADD COLUMN IF NOT EXISTS giorni_presentazione integer,
  ADD COLUMN IF NOT EXISTS periodicita text DEFAULT 'annuale',
  ADD COLUMN IF NOT EXISTS libro_matricola text DEFAULT 'no';

-- Sezione IMPORTI
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS rimborso boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valuta text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS cambio numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS indicizzata boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_calcolo_tasse boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premio_netto numeric,
  ADD COLUMN IF NOT EXISTS addizionali numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasse numeric,
  ADD COLUMN IF NOT EXISTS provvigioni_firma numeric,
  ADD COLUMN IF NOT EXISTS provvigioni_quietanza numeric,
  ADD COLUMN IF NOT EXISTS premio_netto_quietanza numeric,
  ADD COLUMN IF NOT EXISTS addizionali_quietanza numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasse_quietanza numeric,
  ADD COLUMN IF NOT EXISTS pag_diretto_compagnia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS emissione_fee boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS formato_elettronico boolean DEFAULT false;

-- Sezione SOSTITUZIONI/STORNI
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS sostituisce_polizza text,
  ADD COLUMN IF NOT EXISTS sostituisce_riga integer,
  ADD COLUMN IF NOT EXISTS sostituisce_appendice text,
  ADD COLUMN IF NOT EXISTS storno_polizza text,
  ADD COLUMN IF NOT EXISTS storno_riga integer,
  ADD COLUMN IF NOT EXISTS storno_appendice text;

-- =====================================================
-- Tabella dettaglio_riparto (coassicurazione)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.dettaglio_riparto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  compagnia_id uuid REFERENCES public.compagnie(id),
  quota_percentuale numeric DEFAULT 100,
  perc_provv_netto numeric DEFAULT 0,
  perc_provv_addizionali numeric DEFAULT 0,
  netto numeric DEFAULT 0,
  addizionali numeric DEFAULT 0,
  tasse numeric DEFAULT 0,
  totale numeric DEFAULT 0,
  provv_netto numeric DEFAULT 0,
  provv_addizionali numeric DEFAULT 0,
  tipo_pagamento text DEFAULT 'C',
  data_copertura date,
  emissione_compagnia text,
  perc_gestione numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dettaglio_riparto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dettaglio_riparto"
  ON public.dettaglio_riparto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dettaglio_riparto"
  ON public.dettaglio_riparto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dettaglio_riparto"
  ON public.dettaglio_riparto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete dettaglio_riparto"
  ON public.dettaglio_riparto FOR DELETE TO authenticated USING (true);
