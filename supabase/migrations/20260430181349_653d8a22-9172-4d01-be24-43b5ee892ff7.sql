ALTER TABLE public.uffici
  ADD COLUMN IF NOT EXISTS cap text,
  ADD COLUMN IF NOT EXISTS citta text,
  ADD COLUMN IF NOT EXISTS provincia text;

UPDATE public.uffici
SET indirizzo = 'Via Giobatta dall''Armi 3/2',
    cap = '30027',
    citta = 'San Donà di Piave',
    provincia = 'VE'
WHERE codice_ufficio = 'SDO'
  AND indirizzo ILIKE '%Giobatta%';