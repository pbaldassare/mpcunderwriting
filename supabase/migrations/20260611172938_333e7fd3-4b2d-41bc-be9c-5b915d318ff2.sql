
ALTER TABLE public.prodotti_cga
  ADD COLUMN IF NOT EXISTS oggetto_assicurazione text,
  ADD COLUMN IF NOT EXISTS ambito_territoriale text,
  ADD COLUMN IF NOT EXISTS termine_prescrizione_mesi integer,
  ADD COLUMN IF NOT EXISTS termini_pagamento_premio_giorni integer,
  ADD COLUMN IF NOT EXISTS diritto_recesso_descrizione text,
  ADD COLUMN IF NOT EXISTS foro_competente text,
  ADD COLUMN IF NOT EXISTS regime_fiscale text,
  ADD COLUMN IF NOT EXISTS limiti_eta_assicurato_min integer,
  ADD COLUMN IF NOT EXISTS limiti_eta_assicurato_max integer,
  ADD COLUMN IF NOT EXISTS clausola_broker text,
  ADD COLUMN IF NOT EXISTS compagnia_ivass_albo text,
  ADD COLUMN IF NOT EXISTS compagnia_gruppo_ivass text,
  ADD COLUMN IF NOT EXISTS compagnia_pec text,
  ADD COLUMN IF NOT EXISTS compagnia_telefono text,
  ADD COLUMN IF NOT EXISTS compagnia_sede_legale text,
  ADD COLUMN IF NOT EXISTS compagnia_sede_operativa text;

-- Articoli normativi numerati (es. Norme comuni, Norme operative)
CREATE TABLE IF NOT EXISTS public.prodotti_articoli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  sezione text,                  -- es. "Norme comuni", "Come è prestata l'assicurazione"
  numero text,                   -- es. "1.7", "2.11"
  titolo text,
  testo text NOT NULL,
  ordine integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_articoli TO authenticated;
GRANT ALL ON public.prodotti_articoli TO service_role;
ALTER TABLE public.prodotti_articoli ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read prodotti_articoli"
  ON public.prodotti_articoli FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write prodotti_articoli"
  ON public.prodotti_articoli FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_prodotti_articoli_prodotto ON public.prodotti_articoli(prodotto_id);

-- Riferimenti normativi citati (leggi, decreti, articoli codice civile)
CREATE TABLE IF NOT EXISTS public.prodotti_riferimenti_normativi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  riferimento text NOT NULL,     -- es. "D.Lgs. 209/2005", "L. 136/2010", "art. 1917 c.c."
  contesto text,                 -- breve descrizione del perché è citato
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_riferimenti_normativi TO authenticated;
GRANT ALL ON public.prodotti_riferimenti_normativi TO service_role;
ALTER TABLE public.prodotti_riferimenti_normativi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read prodotti_riferimenti"
  ON public.prodotti_riferimenti_normativi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write prodotti_riferimenti"
  ON public.prodotti_riferimenti_normativi FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_prodotti_rif_prodotto ON public.prodotti_riferimenti_normativi(prodotto_id);
