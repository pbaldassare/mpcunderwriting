-- 1) Aggiorna profilo Paola Scarpelli: ruolo, sede, telefono, dati RUI, permessi L3 default
UPDATE public.profiles
SET
  ruolo = 'backoffice',
  ufficio_id = 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a',
  telefono = '081 7648268',
  sezione_rui = 'E',
  numero_rui = 'E000354024',
  data_iscrizione_rui = '2010-09-14'::date,
  attivo = true,
  permessi_json = jsonb_build_object(
    'titoli', true,
    'sinistri', true,
    'trattative', true,
    'calendario', true,
    'contabilita', true,
    'rimesse', true,
    'ec_clienti', true,
    'chiusure', false,
    'cfo_area', false,
    'report', true,
    'estrazioni', true,
    'anagrafiche', false,
    'tabelle_base', false,
    'compagnie', false,
    'uffici', false,
    'manutenzione', false,
    'documentale', true,
    'template', true,
    'provvigioni', true,
    'riceve_provvigioni', false,
    'pagamenti_provvigioni', false
  )
WHERE id = '1e16e933-ef2f-4732-a9e6-2aab1a4c89d5';

-- 2) Sincronizza user_roles: rimuovi admin, aggiungi backoffice (idempotente)
DELETE FROM public.user_roles
WHERE user_id = '1e16e933-ef2f-4732-a9e6-2aab1a4c89d5'
  AND role = 'admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('1e16e933-ef2f-4732-a9e6-2aab1a4c89d5', 'backoffice')
ON CONFLICT (user_id, role) DO NOTHING;