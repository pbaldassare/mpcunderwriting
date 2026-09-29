-- Accessori per riga garanzia + % provvigione accessori in matrice compagnia

ALTER TABLE public.premi_garanzia_polizza
  ADD COLUMN IF NOT EXISTS accessori numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provvigione_netto_pct numeric(8,4) NULL,
  ADD COLUMN IF NOT EXISTS provvigione_accessori_pct numeric(8,4) NULL;

COMMENT ON COLUMN public.premi_garanzia_polizza.accessori IS
  'Importo accessori per voce garanzia (imponibile = netto + accessori per calcolo tasse)';
COMMENT ON COLUMN public.premi_garanzia_polizza.provvigione_netto_pct IS
  'Snapshot % provvigione su premio netto al momento del salvataggio';
COMMENT ON COLUMN public.premi_garanzia_polizza.provvigione_accessori_pct IS
  'Snapshot % provvigione su accessori al momento del salvataggio';

ALTER TABLE public.provvigioni_compagnia_ramo
  ADD COLUMN IF NOT EXISTS percentuale_provvigione_accessori numeric(8,4) NULL;

COMMENT ON COLUMN public.provvigioni_compagnia_ramo.percentuale_provvigione_accessori IS
  '% provvigione su accessori; NULL = eredita percentuale_provvigione (netto)';
