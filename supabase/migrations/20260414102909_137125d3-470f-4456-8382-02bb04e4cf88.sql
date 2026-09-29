
-- 1) UPDATE titoli
UPDATE public.titoli SET
  numero_titolo = 'AXKY130P',
  compagnia_id = '963c5c51-a14c-4ff5-87ff-3b1f0c930ceb',
  id_legacy = 142743,
  descrizione_polizza = 'TG. DA62414 X MAX 250 - MAURIZIO',
  durata_da = '2022-04-20',
  durata_a = '2026-04-20',
  garanzia_da = '2025-04-20',
  garanzia_a = '2026-04-20',
  data_competenza = '2025-05-13',
  comp_assicurativa = '2025-05-13',
  data_incasso = '2025-05-13',
  anni_durata = 4,
  disdetta_mesi = 3,
  no_calcolo_tasse = true,
  premio_netto = 175.48,
  addizionali = 19.09,
  tasse = 48.43,
  premio_netto_quietanza = 175.48,
  addizionali_quietanza = 19.09,
  tasse_quietanza = 48.43,
  provvigioni_quietanza = 20.00,
  tipo_scadenza = 'no scadenza',
  giorni_presentazione = 0,
  tipo_portafoglio = 'POLIZZE FAMIGLIA FIORE',
  gruppo_ramo = 'R.C.A.',
  targa_telaio = 'DA62414',
  conto_incasso = 'CASSA NAPOLI'
WHERE id = 'e32fcd8f-b583-4d78-bf54-2600106d0f0d';

-- 2) INSERT veicolo
INSERT INTO public.veicoli_polizza (
  titolo_id, settore, tipo_veicolo, uso, provincia_circolazione,
  classe_bm, massimale_1, massimale_2, massimale_3,
  targa, veicolo_descrizione, cv, kw, cc, posti, franchigia
) VALUES (
  'e32fcd8f-b583-4d78-bf54-2600106d0f0d',
  'Ciclomotori o Motoveicoli per trasporto cose', 'MOTOCICLO', 'TRASPORTO CONTRO PROPRIO', 'Potenza',
  '04', 6000, 6000, 6000,
  'DA62414', 'X MAX 250 - MAURIZIO', 0, 0, 250, 0, 0.00
);

-- 3) INSERT premi garanzia (7 righe)
INSERT INTO public.premi_garanzia_polizza (titolo_id, garanzia, capitale, tasso, firma, rata, annuo) VALUES
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'RC', NULL, NULL, 175.48, 175.48, 0.00),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'Furto/Incendio/Eventi', 0, 0, 0, 0, 0),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'Tutela Legale', 0, 0, 0, 0, 0),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'ARD', 0, 0, 0, 0, 0),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'Kasko/Cristalli', 0, 0, 0, 0, 0),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'Ass. Stradale', 0, 0, 19.09, 19.09, 0),
  ('e32fcd8f-b583-4d78-bf54-2600106d0f0d', 'Infortuni', 0, 0, 0, 0, 0);

-- 4) INSERT conducente
INSERT INTO public.conducenti_polizza (
  titolo_id, nome, indirizzo, cap, citta, provincia
) VALUES (
  'e32fcd8f-b583-4d78-bf54-2600106d0f0d',
  'CONSULBROKERS SPA', 'VIALE MARCONI, 90', '85100', 'POTENZA', 'PZ'
);
