
-- 1) UPDATE titoli
UPDATE public.titoli SET
  numero_titolo = 'G02.013.0000051933',
  compagnia_id = '90a1b149-c19b-4175-ad2d-9875133ebb34',
  id_legacy = 168419,
  durata_da = '2026-04-10',
  durata_a = '2027-04-10',
  garanzia_da = '2026-04-10',
  garanzia_a = '2027-04-10',
  data_scadenza = '2027-04-10',
  data_competenza = '2026-04-13',
  comp_assicurativa = '2026-04-13',
  premio_netto = 660.16,
  addizionali = 231.00,
  tasse = 205.32,
  premio_lordo = 1096.48,
  provvigioni_firma = 57.03,
  premio_netto_quietanza = 660.16,
  addizionali_quietanza = 231.00,
  tasse_quietanza = 205.84,
  provvigioni_quietanza = 57.03,
  no_calcolo_tasse = true,
  tipo_scadenza = 'no scadenza',
  giorni_presentazione = 0,
  targa_telaio = 'FT914NM'
WHERE id = 'a6f960c1-32b6-4983-9f2c-6d8ffd2e1211';

-- 2) INSERT veicolo
INSERT INTO public.veicoli_polizza (
  titolo_id, settore, tipo_veicolo, uso, provincia_circolazione,
  classe_bm, targa, veicolo_descrizione, cv, kw, posti, franchigia
) VALUES (
  'a6f960c1-32b6-4983-9f2c-6d8ffd2e1211',
  'Autovetture', 'AUTOVETTURA', 'PRIVATO', 'Napoli',
  '06', 'FT914NM', 'AUDI A1 GIALLA', 16, 85, 5, 0.00
);

-- 3) INSERT premi garanzia
INSERT INTO public.premi_garanzia_polizza (titolo_id, garanzia, capitale, tasso, firma, rata, annuo) VALUES
  ('a6f960c1-32b6-4983-9f2c-6d8ffd2e1211', 'RC', NULL, NULL, 660.16, 660.16, 660.16),
  ('a6f960c1-32b6-4983-9f2c-6d8ffd2e1211', 'Furto/Incendio/Eventi', 13100.00, 0.00, 200.00, 200.00, 200.00),
  ('a6f960c1-32b6-4983-9f2c-6d8ffd2e1211', 'Tutela Legale', 0.00, 0.00, 0.00, 0.00, 0.00),
  ('a6f960c1-32b6-4983-9f2c-6d8ffd2e1211', 'ARD', 0.00, 0.00, 31.00, 31.00, 31.00);
