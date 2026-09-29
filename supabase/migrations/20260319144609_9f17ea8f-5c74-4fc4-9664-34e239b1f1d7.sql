
-- Update existing incassato titoli with data_incasso, importo_incassato, produttore_id
UPDATE public.titoli SET 
  data_incasso = '2025-01-20', importo_incassato = 1250.00, produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00142';

UPDATE public.titoli SET 
  data_incasso = '2025-03-28', importo_incassato = 890.50, produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00287';

UPDATE public.titoli SET 
  produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2024-00891';

UPDATE public.titoli SET 
  produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00503';

UPDATE public.titoli SET 
  data_incasso = '2025-09-10', importo_incassato = 3200.00, produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00611';

UPDATE public.titoli SET 
  data_incasso = '2025-02-25', importo_incassato = 5600.00, produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00720';

UPDATE public.titoli SET 
  produttore_id = 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'
WHERE numero_titolo = 'POL-2025-00721';

-- Additional titoli for Gallo Veronica
INSERT INTO public.titoli (numero_titolo, stato, premio_lordo, data_incasso, importo_incassato, cliente_anagrafica_id, prodotto_id, ufficio_id, produttore_id, created_at)
VALUES
  ('POL-2025-00830', 'incassato', 980.00, '2025-04-15', 980.00, 'a2a0979a-2f48-4109-b04a-b1b1bc60d1a4', 'fb85d788-2986-46f2-a0fc-a14da51ef56b', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-04-10'),
  ('POL-2025-00831', 'incassato', 1450.00, '2025-05-20', 1450.00, 'a2a0979a-2f48-4109-b04a-b1b1bc60d1a4', 'dff711ce-f4bf-4c6d-afda-6f48b90b166d', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-05-15'),
  ('POL-2025-00832', 'creato', 720.00, NULL, NULL, 'a2a0979a-2f48-4109-b04a-b1b1bc60d1a4', '92a6b7ba-2f5d-4287-9b20-a1cc0f052585', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-06-01');

-- Additional titoli for Martini Massimo
INSERT INTO public.titoli (numero_titolo, stato, premio_lordo, data_incasso, importo_incassato, cliente_anagrafica_id, prodotto_id, ufficio_id, produttore_id, created_at)
VALUES
  ('POL-2025-00840', 'incassato', 2300.00, '2025-06-10', 2300.00, '51ce1cd6-0fea-4e1c-a045-d25105498f07', '875f94eb-4c13-4e79-bbea-43e3e3609d21', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-06-05'),
  ('POL-2025-00841', 'incassato', 3100.00, '2025-07-18', 3100.00, '51ce1cd6-0fea-4e1c-a045-d25105498f07', '7e654d30-4646-4aae-a28c-72373428f93e', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-07-12'),
  ('POL-2025-00842', 'creato', 550.00, NULL, NULL, '51ce1cd6-0fea-4e1c-a045-d25105498f07', '8e87d607-a76f-4078-9e4d-f726a64df4e8', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-08-01');

-- Additional titoli for Martinelli Lorenzo
INSERT INTO public.titoli (numero_titolo, stato, premio_lordo, data_incasso, importo_incassato, cliente_anagrafica_id, prodotto_id, ufficio_id, produttore_id, created_at)
VALUES
  ('POL-2025-00850', 'incassato', 1850.00, '2025-08-05', 1850.00, 'e47ebb5c-44e1-4c65-b63b-6129c3196684', '71362cf2-904e-490a-a4d8-1fb371545e75', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-08-01'),
  ('POL-2025-00851', 'creato', 670.00, NULL, NULL, 'e47ebb5c-44e1-4c65-b63b-6129c3196684', '78935798-ce38-4c6a-9082-eb1d49e49ad5', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', '2025-09-01');

-- Seed matrice_provvigioni for all products used
INSERT INTO public.matrice_provvigioni (prodotto_id, ruolo, percentuale_provvigione, tipo_calcolo, attiva, ufficio_id)
VALUES
  ('875f94eb-4c13-4e79-bbea-43e3e3609d21', 'produttore', 15.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('71362cf2-904e-490a-a4d8-1fb371545e75', 'produttore', 12.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('7e654d30-4646-4aae-a28c-72373428f93e', 'produttore', 14.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('f1e8eb44-6063-49ac-a3e6-d2e1ccb16553', 'produttore', 10.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('92a6b7ba-2f5d-4287-9b20-a1cc0f052585', 'produttore', 13.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('fb85d788-2986-46f2-a0fc-a14da51ef56b', 'produttore', 16.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('dff711ce-f4bf-4c6d-afda-6f48b90b166d', 'produttore', 15.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('8e87d607-a76f-4078-9e4d-f726a64df4e8', 'produttore', 11.00, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'),
  ('78935798-ce38-4c6a-9082-eb1d49e49ad5', 'produttore', 12.50, 'percentuale', true, '5d5ddfa7-2df7-4234-ae1b-38487574b4c2');

-- Seed provvigioni_generate for all incassato titoli
-- Paola Colombo titoli
INSERT INTO public.provvigioni_generate (titolo_id, user_id, percentuale, importo_provvigione, pagata, calcolata_il)
SELECT t.id, 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 
  CASE t.prodotto_id
    WHEN '875f94eb-4c13-4e79-bbea-43e3e3609d21' THEN 15.00
    WHEN '71362cf2-904e-490a-a4d8-1fb371545e75' THEN 12.00
    WHEN '7e654d30-4646-4aae-a28c-72373428f93e' THEN 14.00
  END,
  t.importo_incassato * CASE t.prodotto_id
    WHEN '875f94eb-4c13-4e79-bbea-43e3e3609d21' THEN 0.15
    WHEN '71362cf2-904e-490a-a4d8-1fb371545e75' THEN 0.12
    WHEN '7e654d30-4646-4aae-a28c-72373428f93e' THEN 0.14
  END,
  false,
  t.data_incasso::timestamptz
FROM titoli t
WHERE t.stato = 'incassato' AND t.cliente_anagrafica_id = '3fa445e7-1695-4f1b-94a6-88290da3e807';

-- IT Solutions titoli
INSERT INTO public.provvigioni_generate (titolo_id, user_id, percentuale, importo_provvigione, pagata, calcolata_il)
SELECT t.id, 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 15.00, t.importo_incassato * 0.15, false, t.data_incasso::timestamptz
FROM titoli t
WHERE t.stato = 'incassato' AND t.numero_titolo = 'POL-2025-00720';

-- Gallo Veronica titoli
INSERT INTO public.provvigioni_generate (titolo_id, user_id, percentuale, importo_provvigione, pagata, calcolata_il)
VALUES
  ((SELECT id FROM titoli WHERE numero_titolo='POL-2025-00830'), 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 16.00, 980.00 * 0.16, false, '2025-04-15'),
  ((SELECT id FROM titoli WHERE numero_titolo='POL-2025-00831'), 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 15.00, 1450.00 * 0.15, false, '2025-05-20');

-- Martini Massimo titoli
INSERT INTO public.provvigioni_generate (titolo_id, user_id, percentuale, importo_provvigione, pagata, calcolata_il)
VALUES
  ((SELECT id FROM titoli WHERE numero_titolo='POL-2025-00840'), 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 15.00, 2300.00 * 0.15, false, '2025-06-10'),
  ((SELECT id FROM titoli WHERE numero_titolo='POL-2025-00841'), 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 14.00, 3100.00 * 0.14, false, '2025-07-18');

-- Martinelli Lorenzo titoli
INSERT INTO public.provvigioni_generate (titolo_id, user_id, percentuale, importo_provvigione, pagata, calcolata_il)
VALUES
  ((SELECT id FROM titoli WHERE numero_titolo='POL-2025-00850'), 'aed93cfd-12ba-4f28-9d5c-efe39935aa94', 12.00, 1850.00 * 0.12, false, '2025-08-05');
