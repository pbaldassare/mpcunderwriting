-- 1) AIG: tieni GC001 ('AIG'), elimina GC011 ('Aig')
UPDATE public.compagnie
SET gruppo_compagnia_id = '002c5420-d1f2-47a3-8436-94c4ffe50b42',
    gruppo_compagnia    = 'AIG'
WHERE gruppo_compagnia_id = '9a60712a-ddd8-4c61-999c-aa49c0183ce6';
DELETE FROM public.gruppi_compagnia WHERE id = '9a60712a-ddd8-4c61-999c-aa49c0183ce6';

-- 2) ASSIMOCO: tieni GC007 ('ASSIMOCO'), elimina GC019 ('Assimoco')
UPDATE public.compagnie
SET gruppo_compagnia_id = 'acf0800e-291f-4992-97ae-46e148047cda',
    gruppo_compagnia    = 'ASSIMOCO'
WHERE gruppo_compagnia_id = 'bbec5de0-757d-46e9-8be5-80df30000bd9';
DELETE FROM public.gruppi_compagnia WHERE id = 'bbec5de0-757d-46e9-8be5-80df30000bd9';

-- 3) ROLAND: tieni GC105 ('ROLAND'), elimina GC109 ('Roland')
UPDATE public.compagnie
SET gruppo_compagnia_id = '4e6858d7-a924-4640-bc13-987c6f7a0c94',
    gruppo_compagnia    = 'ROLAND'
WHERE gruppo_compagnia_id = '263f08ef-dbcf-44c7-a758-c463f44cf866';
DELETE FROM public.gruppi_compagnia WHERE id = '263f08ef-dbcf-44c7-a758-c463f44cf866';

-- 4) PLURIMANDATARIO: tieni codice 'PLURIMANDATARIO' ('PLURIMANDATARIO'), elimina GC099 ('Plurimandatario')
UPDATE public.compagnie
SET gruppo_compagnia_id = 'adb2041b-9bb4-4f09-a092-01f1d6accfbd',
    gruppo_compagnia    = 'PLURIMANDATARIO'
WHERE gruppo_compagnia_id = '8c6f1c2e-bd13-44ca-8c8b-edcca9b6e832';
DELETE FROM public.gruppi_compagnia WHERE id = '8c6f1c2e-bd13-44ca-8c8b-edcca9b6e832';

-- 5) Allinea (best-effort) i campi testo eventualmente rimasti scritti col casing vecchio
UPDATE public.compagnie SET gruppo_compagnia = 'AIG'             WHERE gruppo_compagnia ILIKE 'aig'             AND gruppo_compagnia <> 'AIG';
UPDATE public.compagnie SET gruppo_compagnia = 'ASSIMOCO'        WHERE gruppo_compagnia ILIKE 'assimoco'        AND gruppo_compagnia <> 'ASSIMOCO';
UPDATE public.compagnie SET gruppo_compagnia = 'ROLAND'          WHERE gruppo_compagnia ILIKE 'roland'          AND gruppo_compagnia <> 'ROLAND';
UPDATE public.compagnie SET gruppo_compagnia = 'PLURIMANDATARIO' WHERE gruppo_compagnia ILIKE 'plurimandatario' AND gruppo_compagnia <> 'PLURIMANDATARIO';

-- 6) Indice unico case-insensitive per evitare nuovi duplicati
CREATE UNIQUE INDEX IF NOT EXISTS gruppi_compagnia_descrizione_ci_uniq
  ON public.gruppi_compagnia (UPPER(TRIM(descrizione)));