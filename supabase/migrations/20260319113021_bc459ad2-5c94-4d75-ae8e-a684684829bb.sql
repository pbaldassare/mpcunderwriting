
-- Add unique constraint on (codice, tipo) for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_anagrafiche_prof_codice_tipo 
ON public.anagrafiche_professionali (codice, tipo) 
WHERE codice IS NOT NULL;
