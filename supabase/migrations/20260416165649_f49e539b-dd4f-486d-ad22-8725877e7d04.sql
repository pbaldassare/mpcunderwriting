DELETE FROM anagrafiche_professionali
WHERE tipo IN ('liquidatore','perito','legale')
  AND codice ILIKE 'DEMO-%';