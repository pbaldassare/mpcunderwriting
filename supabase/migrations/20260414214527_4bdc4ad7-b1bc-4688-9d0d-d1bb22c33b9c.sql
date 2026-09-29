-- Add new column to link titoli to anagrafiche_professionali
ALTER TABLE public.titoli 
ADD COLUMN IF NOT EXISTS anagrafica_commerciale_id UUID REFERENCES public.anagrafiche_professionali(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_titoli_anagrafica_commerciale_id ON public.titoli(anagrafica_commerciale_id);

-- Backfill: match produttore_nome to anagrafiche_professionali.ragione_sociale
UPDATE public.titoli t
SET anagrafica_commerciale_id = ap.id
FROM public.anagrafiche_professionali ap
WHERE UPPER(TRIM(t.produttore_nome)) = UPPER(TRIM(ap.ragione_sociale))
  AND t.anagrafica_commerciale_id IS NULL
  AND t.produttore_nome IS NOT NULL
  AND t.produttore_nome != ''
  AND UPPER(TRIM(t.produttore_nome)) NOT LIKE '%CONSULBROKER%';

-- Also try matching on cognome + nome concatenation
UPDATE public.titoli t
SET anagrafica_commerciale_id = ap.id
FROM public.anagrafiche_professionali ap
WHERE t.anagrafica_commerciale_id IS NULL
  AND t.produttore_nome IS NOT NULL
  AND t.produttore_nome != ''
  AND UPPER(TRIM(t.produttore_nome)) NOT LIKE '%CONSULBROKER%'
  AND UPPER(TRIM(t.produttore_nome)) = UPPER(TRIM(COALESCE(ap.cognome, '') || ' ' || COALESCE(ap.nome, '')));

-- Set percentuale_commerciale from anagrafica's percentuale_base
UPDATE public.titoli t
SET percentuale_commerciale = ap.percentuale_base
FROM public.anagrafiche_professionali ap
WHERE t.anagrafica_commerciale_id = ap.id
  AND ap.percentuale_base IS NOT NULL
  AND ap.percentuale_base > 0
  AND (t.percentuale_commerciale IS NULL OR t.percentuale_commerciale = 100);