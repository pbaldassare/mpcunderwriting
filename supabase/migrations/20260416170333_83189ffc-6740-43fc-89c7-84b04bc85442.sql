-- 1. Cancella anagrafiche professionali DEMO (Account Executive)
DELETE FROM anagrafiche_professionali
WHERE codice ILIKE 'DEMO-%' OR email ILIKE '%demo%';

-- 2. Cancella prospect DEMO
DELETE FROM prospect
WHERE email ILIKE '%demo%' OR cognome ILIKE 'demo%' OR ragione_sociale ILIKE '%demo%';

-- 3. Cancella dati collegati ai 10 profili demo (per evitare violazioni FK)
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM profiles WHERE email ILIKE '%@demo-agenzia.it');
DELETE FROM codici_commerciali_cliente WHERE profilo_id IN (SELECT id FROM profiles WHERE email ILIKE '%@demo-agenzia.it');
DELETE FROM chat_canali_membri WHERE user_id IN (SELECT id FROM profiles WHERE email ILIKE '%@demo-agenzia.it');
DELETE FROM documenti_utenti WHERE user_id IN (SELECT id FROM profiles WHERE email ILIKE '%@demo-agenzia.it');
DELETE FROM chat_conferme_lettura WHERE user_id IN (SELECT id FROM profiles WHERE email ILIKE '%@demo-agenzia.it');

-- 4. Cancella i profili demo
DELETE FROM profiles WHERE email ILIKE '%@demo-agenzia.it';

-- 5. Cancella gli auth users demo
DELETE FROM auth.users WHERE email ILIKE '%@demo-agenzia.it';