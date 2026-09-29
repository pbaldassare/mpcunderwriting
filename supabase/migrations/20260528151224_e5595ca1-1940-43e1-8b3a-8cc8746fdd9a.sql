ALTER TABLE public.compagnie ADD COLUMN IF NOT EXISTS ritenuta_acconto numeric(5,2) NOT NULL DEFAULT 4.60;
ALTER TABLE public.compagnia_rapporti ADD COLUMN IF NOT EXISTS ritenuta_acconto numeric(5,2) DEFAULT 4.60;
ALTER TABLE public.anagrafiche_professionali ALTER COLUMN percentuale_ra SET DEFAULT 4.60;
UPDATE public.anagrafiche_professionali SET percentuale_ra = 4.60 WHERE percentuale_ra IS NULL;