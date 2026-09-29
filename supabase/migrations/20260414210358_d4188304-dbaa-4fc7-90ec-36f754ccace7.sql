
-- Step 0: Delete distinta righe linked to demo movements
DELETE FROM public.distinte_giornaliere_righe 
WHERE movimento_id IN (SELECT id FROM public.movimenti_contabili WHERE descrizione LIKE '%[DEMO]%');

-- Step 1: Delete all bank reconciliation records
DELETE FROM public.incroci_bancari;

-- Step 2: Delete all demo bank statement records
DELETE FROM public.estratti_conto;

-- Step 3: Delete all demo accounting movements
DELETE FROM public.movimenti_contabili;
