UPDATE public.titoli t
   SET percentuale_commerciale = ap.percentuale_base
  FROM public.anagrafiche_professionali ap
 WHERE t.anagrafica_commerciale_id = ap.id
   AND t.id = '076a48d8-f31f-4911-8faf-0f680ff02672'
   AND ap.percentuale_base IS NOT NULL;