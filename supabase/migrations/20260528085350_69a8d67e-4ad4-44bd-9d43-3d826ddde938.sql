UPDATE public.anagrafiche_professionali
SET ufficio_id = NULL
WHERE tipo = 'account_executive'
  AND ufficio_id IS NOT NULL;