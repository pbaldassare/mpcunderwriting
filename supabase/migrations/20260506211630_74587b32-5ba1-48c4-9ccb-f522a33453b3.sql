-- 1. Allinea responsabile_sede INTERFIDI ai default 40/0/4.6
UPDATE public.anagrafiche_professionali
SET percentuale_base = 40, percentuale_consulenza = 0, percentuale_ra = 4.6
WHERE id = '1319a4a9-6961-4ad5-b6be-b0dd62ac04df';

-- 2. Elimina la corrispondente duplicata vuota
DELETE FROM public.anagrafiche_professionali
WHERE id = 'c5524fca-9671-4738-b55d-6992cf7aebc8';

-- 3. Collega gli 8 titoli legacy alla corrispondente "buona"
UPDATE public.titoli
SET anagrafica_commerciale_id = 'cbe0e599-5f2e-4be9-b9d4-8b48347368d3',
    percentuale_commerciale = 100
WHERE produttore_nome ILIKE '%INTERFIDI%'
  AND anagrafica_commerciale_id IS NULL;

-- 4. Ricalcolo provvigioni dove premio_netto > 0 (bypass lock storico)
SET LOCAL app.bypass_premi_lock = 'on';
UPDATE public.titoli
SET provvigioni_firma = ROUND(premio_netto * 0.40, 2),
    provvigioni_quietanza = ROUND(COALESCE(premio_netto_quietanza, premio_netto) * 0.40, 2)
WHERE anagrafica_commerciale_id = 'cbe0e599-5f2e-4be9-b9d4-8b48347368d3'
  AND premio_netto IS NOT NULL
  AND premio_netto > 0;