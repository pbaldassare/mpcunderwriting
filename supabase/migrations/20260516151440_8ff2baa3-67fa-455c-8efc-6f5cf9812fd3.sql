ALTER TABLE public.compagnia_rapporti
  ADD COLUMN IF NOT EXISTS nome_rapporto text,
  ADD COLUMN IF NOT EXISTS sede_denominazione text,
  ADD COLUMN IF NOT EXISTS sede_indirizzo text,
  ADD COLUMN IF NOT EXISTS sede_cap text,
  ADD COLUMN IF NOT EXISTS sede_citta text,
  ADD COLUMN IF NOT EXISTS sede_provincia text;