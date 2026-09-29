-- Compagnie: usa il già esistente percentuale_ra
ALTER TABLE public.compagnie ALTER COLUMN percentuale_ra SET DEFAULT 4.60;
UPDATE public.compagnie SET percentuale_ra = 4.60 WHERE percentuale_ra IS NULL OR percentuale_ra = 0;

-- Rapporti compagnia: aggiungi percentuale_ra (lasciamo nullable per fallback su compagnia)
ALTER TABLE public.compagnia_rapporti ADD COLUMN IF NOT EXISTS percentuale_ra numeric(5,2) DEFAULT 4.60;

-- Rimuovi la colonna duplicata appena creata (non usata da UI)
ALTER TABLE public.compagnie DROP COLUMN IF EXISTS ritenuta_acconto;
ALTER TABLE public.compagnia_rapporti DROP COLUMN IF EXISTS ritenuta_acconto;