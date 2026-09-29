WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY codice, descrizione
           ORDER BY id
         ) AS rn
  FROM public.rca_usi
  WHERE attivo = true
)
UPDATE public.rca_usi
SET attivo = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);