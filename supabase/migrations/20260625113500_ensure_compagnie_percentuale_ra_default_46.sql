-- Garantisce default e backfill della % ritenuta d'acconto per le agenzie.
ALTER TABLE IF EXISTS public.compagnie
  ALTER COLUMN percentuale_ra SET DEFAULT 4.60;

UPDATE public.compagnie
SET percentuale_ra = 4.60
WHERE percentuale_ra IS NULL;
