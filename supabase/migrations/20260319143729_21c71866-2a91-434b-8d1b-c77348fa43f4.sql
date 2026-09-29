-- Seed: 5 polizze per Paola Colombo (privato)
INSERT INTO public.titoli (numero_titolo, stato, premio_lordo, cliente_anagrafica_id, prodotto_id, ufficio_id, created_at)
VALUES
  ('POL-2025-00142', 'incassato', 1250.00, '3fa445e7-1695-4f1b-94a6-88290da3e807', '875f94eb-4c13-4e79-bbea-43e3e3609d21', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-01-15'),
  ('POL-2025-00287', 'incassato', 890.50, '3fa445e7-1695-4f1b-94a6-88290da3e807', '71362cf2-904e-490a-a4d8-1fb371545e75', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-03-22'),
  ('POL-2024-00891', 'stornato', 2100.00, '3fa445e7-1695-4f1b-94a6-88290da3e807', 'f1e8eb44-6063-49ac-a3e6-d2e1ccb16553', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2024-06-10'),
  ('POL-2025-00503', 'creato', 450.00, '3fa445e7-1695-4f1b-94a6-88290da3e807', '92a6b7ba-2f5d-4287-9b20-a1cc0f052585', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-07-01'),
  ('POL-2025-00611', 'incassato', 3200.00, '3fa445e7-1695-4f1b-94a6-88290da3e807', '7e654d30-4646-4aae-a28c-72373428f93e', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-09-05');

-- Seed: 2 polizze per IT Solutions Sorrentino (azienda)
INSERT INTO public.titoli (numero_titolo, stato, premio_lordo, cliente_anagrafica_id, prodotto_id, ufficio_id, created_at)
VALUES
  ('POL-2025-00720', 'incassato', 5600.00, '4aa8bf30-59c7-491f-8b69-e5f033af0287', '875f94eb-4c13-4e79-bbea-43e3e3609d21', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-02-18'),
  ('POL-2025-00721', 'creato', 1800.00, '4aa8bf30-59c7-491f-8b69-e5f033af0287', 'f1e8eb44-6063-49ac-a3e6-d2e1ccb16553', '5d5ddfa7-2df7-4234-ae1b-38487574b4c2', '2025-04-10');

-- Seed: 2 relazioni Paola Colombo ↔ aziende
INSERT INTO public.clienti_relazioni (cliente_id, cliente_collegato_id, tipo_relazione, note)
VALUES
  ('3fa445e7-1695-4f1b-94a6-88290da3e807', '4aa8bf30-59c7-491f-8b69-e5f033af0287', 'dipendente', 'Impiegata presso IT Solutions dal 2020'),
  ('3fa445e7-1695-4f1b-94a6-88290da3e807', 'd0ec1a23-ff4c-4c1e-a24a-269d024f38b3', 'legale_rappresentante', 'Amministratore unico dal 2022');