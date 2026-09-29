-- Limite upload 50 MB (52428800 bytes) per bucket documentali
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id IN (
  'document-library',
  'documenti_banca',
  'documenti_clienti',
  'documenti_generali',
  'documenti_sinistri',
  'documenti_titoli',
  'documenti_utenti',
  'rimesse-pdf'
);

-- Allinea impostazione di sistema (UI Impostazioni)
UPDATE public.impostazioni_sistema
SET valore_json = '50'::jsonb,
    descrizione = 'Limite massimo upload file in MB'
WHERE chiave = 'limiti_upload_file_mb';
