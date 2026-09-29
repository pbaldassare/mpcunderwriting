-- Backfill percentuale_ra su rapporti e compagnie (default 4.60%)
UPDATE public.compagnia_rapporti
SET percentuale_ra = 4.60
WHERE percentuale_ra IS NULL OR percentuale_ra = 0;

UPDATE public.compagnie
SET percentuale_ra = 4.60
WHERE percentuale_ra IS NULL OR percentuale_ra = 0;
