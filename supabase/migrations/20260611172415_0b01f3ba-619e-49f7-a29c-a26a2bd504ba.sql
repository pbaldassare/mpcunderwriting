
-- Estensione campi prodotti_cga (dati generici)
ALTER TABLE public.prodotti_cga
  ADD COLUMN IF NOT EXISTS codice_modello text,
  ADD COLUMN IF NOT EXISTS compagnia_email_servizio_clienti text,
  ADD COLUMN IF NOT EXISTS compagnia_url_area_personale text,
  ADD COLUMN IF NOT EXISTS forma_copertura text,
  ADD COLUMN IF NOT EXISTS periodo_retroattivita_mesi integer,
  ADD COLUMN IF NOT EXISTS massimale_aggregato_annuo numeric,
  ADD COLUMN IF NOT EXISTS note_legali text;

-- Estensione campi prodotti_garanzie
ALTER TABLE public.prodotti_garanzie
  ADD COLUMN IF NOT EXISTS sottolimite numeric,
  ADD COLUMN IF NOT EXISTS franchigia_temporale_giorni integer,
  ADD COLUMN IF NOT EXISTS aggregato_annuo numeric,
  ADD COLUMN IF NOT EXISTS ambito_territoriale text;

-- Estensione campi polizza_cga (dati personali)
ALTER TABLE public.polizza_cga
  ADD COLUMN IF NOT EXISTS numero_polizza text,
  ADD COLUMN IF NOT EXISTS contraente_ragione_sociale text,
  ADD COLUMN IF NOT EXISTS contraente_piva text,
  ADD COLUMN IF NOT EXISTS contraente_cf text,
  ADD COLUMN IF NOT EXISTS contraente_indirizzo text,
  ADD COLUMN IF NOT EXISTS contraente_cap text,
  ADD COLUMN IF NOT EXISTS contraente_comune text,
  ADD COLUMN IF NOT EXISTS contraente_provincia text,
  ADD COLUMN IF NOT EXISTS contraente_email text,
  ADD COLUMN IF NOT EXISTS assicurato_descrizione text,
  ADD COLUMN IF NOT EXISTS data_decorrenza date,
  ADD COLUMN IF NOT EXISTS data_scadenza date,
  ADD COLUMN IF NOT EXISTS data_emissione date,
  ADD COLUMN IF NOT EXISTS tacito_rinnovo boolean,
  ADD COLUMN IF NOT EXISTS cig text,
  ADD COLUMN IF NOT EXISTS cup text,
  ADD COLUMN IF NOT EXISTS frazionamento text,
  ADD COLUMN IF NOT EXISTS intermediario_nome text,
  ADD COLUMN IF NOT EXISTS intermediario_indirizzo text,
  ADD COLUMN IF NOT EXISTS intermediario_telefono text,
  ADD COLUMN IF NOT EXISTS intermediario_email text,
  ADD COLUMN IF NOT EXISTS premio_imponibile_totale numeric,
  ADD COLUMN IF NOT EXISTS premio_imposte_totale numeric,
  ADD COLUMN IF NOT EXISTS premio_lordo_totale numeric,
  ADD COLUMN IF NOT EXISTS premio_rata_sottoscrizione_lordo numeric,
  ADD COLUMN IF NOT EXISTS premio_rate_successive_lordo numeric;

-- Nuova tabella: glossario/definizioni del prodotto (generico, condiviso)
CREATE TABLE IF NOT EXISTS public.prodotti_definizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  termine text NOT NULL,
  definizione text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_definizioni TO authenticated;
GRANT ALL ON public.prodotti_definizioni TO service_role;
ALTER TABLE public.prodotti_definizioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read prodotti_definizioni"
  ON public.prodotti_definizioni FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write prodotti_definizioni"
  ON public.prodotti_definizioni FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_prodotti_definizioni_prodotto ON public.prodotti_definizioni(prodotto_id);

-- Nuova tabella: composizione premio per garanzia (per singola polizza)
CREATE TABLE IF NOT EXISTS public.polizza_cga_premio_garanzia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  garanzia text NOT NULL,
  tipo_rata text NOT NULL CHECK (tipo_rata IN ('sottoscrizione','successiva')),
  imponibile numeric,
  imposte numeric,
  lordo numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_cga_premio_garanzia TO authenticated;
GRANT ALL ON public.polizza_cga_premio_garanzia TO service_role;
ALTER TABLE public.polizza_cga_premio_garanzia ENABLE ROW LEVEL SECURITY;
-- Visibilità: ereditata dalla polizza_cga collegata
CREATE POLICY "Read premio garanzia via polizza_cga"
  ON public.polizza_cga_premio_garanzia FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE POLICY "Write premio garanzia via polizza_cga"
  ON public.polizza_cga_premio_garanzia FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polizza_cga p WHERE p.id = polizza_cga_id));
CREATE INDEX IF NOT EXISTS idx_premio_garanzia_polizza ON public.polizza_cga_premio_garanzia(polizza_cga_id);
