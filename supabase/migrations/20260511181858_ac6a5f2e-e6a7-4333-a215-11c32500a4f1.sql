
UPDATE public.rami SET aliquota_tasse_ramo = 21.25, aliquota_tasse_ard = 21.25 WHERE descrizione ILIKE 'TUTELA LEGALE%';
UPDATE public.rami SET aliquota_tasse_ramo = 13.5, aliquota_tasse_ard = 13.5 WHERE descrizione ILIKE 'KASKO%' OR descrizione ILIKE 'A.R.D%' OR codice='DRA';
UPDATE public.rami SET aliquota_tasse_ramo = 4.38, aliquota_tasse_ard = 4.38 WHERE descrizione ILIKE 'INFORTUNI CUMULATIVA CON RC%';
UPDATE public.rami SET aliquota_tasse_ramo = 2.5, aliquota_tasse_ard = 2.5 WHERE descrizione ILIKE 'INFORTUNI CUMULATIVA SENZA%' OR descrizione ILIKE 'MALATTIA%' OR descrizione = 'VITA' OR descrizione ILIKE 'VITA %' OR descrizione ILIKE 'ANIMALI DOMESTICI%';
UPDATE public.rami SET aliquota_tasse_ramo = 12.5, aliquota_tasse_ard = 12.5 WHERE descrizione ILIKE 'ASSISTENZA%' OR descrizione ILIKE 'CAUZION%' OR descrizione ILIKE 'INFORTUNI CONDUCENTE%';
UPDATE public.rami SET aliquota_tasse_ramo = 22.25, aliquota_tasse_ard = 22.25 WHERE 
  descrizione ILIKE 'ALL RISK%' OR descrizione ILIKE 'ALL PATRIMONIO%' OR descrizione ILIKE 'ALL RISKS%'
  OR descrizione ILIKE 'AVIATION%' OR descrizione ILIKE 'CYBER%'
  OR descrizione ILIKE 'D&O%' OR descrizione ILIKE 'D & O%'
  OR descrizione ILIKE 'ELETTRONICA%' OR descrizione ILIKE 'FURTO%' OR descrizione ILIKE 'INCENDIO%'
  OR descrizione ILIKE 'LEASING%' OR descrizione ILIKE 'MOSTRE%'
  OR descrizione ILIKE 'RC CAPOFAMIGLIA%' OR descrizione ILIKE 'RC INQUINAMENTO%' OR descrizione ILIKE 'RC PATRIMONIALE%'
  OR descrizione ILIKE 'RCT%' OR descrizione ILIKE 'RISCHIO MONTAGGIO%' OR descrizione ILIKE 'CATASTROFAL%';
