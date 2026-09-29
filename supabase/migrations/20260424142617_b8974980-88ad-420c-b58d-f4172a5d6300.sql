
-- 1) Garantisci unicità del codice in gruppi_compagnia (necessaria per ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'gruppi_compagnia' 
      AND indexname = 'gruppi_compagnia_codice_key'
  ) THEN
    -- Solo se non esiste già un indice unique sul codice, creane uno parziale per i non-null
    CREATE UNIQUE INDEX IF NOT EXISTS gruppi_compagnia_codice_unique 
      ON public.gruppi_compagnia (codice) 
      WHERE codice IS NOT NULL;
  END IF;
END $$;

-- 2) Inserisci la Compagnia speciale PLURIMANDATARIO (idempotente)
INSERT INTO public.gruppi_compagnia (codice, descrizione, attivo)
SELECT 'PLURIMANDATARIO', 'PLURIMANDATARIO', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.gruppi_compagnia WHERE codice = 'PLURIMANDATARIO'
);

-- 3) Assegna le Agenzie orfane alla Compagnia PLURIMANDATARIO
UPDATE public.compagnie
SET gruppo_compagnia_id = (
  SELECT id FROM public.gruppi_compagnia WHERE codice = 'PLURIMANDATARIO' LIMIT 1
)
WHERE gruppo_compagnia_id IS NULL;

-- 4) Rende obbligatorio il collegamento Agenzia → Compagnia
ALTER TABLE public.compagnie
  ALTER COLUMN gruppo_compagnia_id SET NOT NULL;

-- 5) Documenta la regola
COMMENT ON COLUMN public.compagnie.gruppo_compagnia_id IS 
'Compagnia di appartenenza (obbligatoria). Le Agenzie senza una vera Compagnia sono assegnate al fallback PLURIMANDATARIO.';
