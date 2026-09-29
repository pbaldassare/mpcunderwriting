-- Allinea il limite upload documenti a 25 MB (impostazione di sistema)
UPDATE public.impostazioni_sistema
SET valore_json = '25'::jsonb,
    descrizione = 'Limite massimo upload file in MB'
WHERE chiave = 'limiti_upload_file_mb';
