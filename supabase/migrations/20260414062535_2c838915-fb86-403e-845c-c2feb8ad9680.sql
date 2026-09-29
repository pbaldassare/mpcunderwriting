
-- UPDATE titoli
UPDATE public.titoli SET
  durata_a = '2026-04-22',
  anni_durata = 2,
  garanzia_da = '2025-04-22',
  tasse = 19.00,
  addizionali = 15.97,
  premio_netto_quietanza = 152.03,
  tasse_quietanza = 19.00,
  addizionali_quietanza = 15.97,
  tipo_rinnovo = 'A',
  tipo_scadenza = 'no scadenza',
  giorni_presentazione = 0
WHERE id = '1db21814-5df2-47b3-9135-e6995fe70177';

-- INSERT veicoli_polizza
INSERT INTO public.veicoli_polizza (
  titolo_id, targa, veicolo_descrizione, settore, tipo_veicolo, uso,
  provincia_circolazione, classe_bm, massimale_1, massimale_2, massimale_3,
  franchigia, cv, kw, cc, posti
) VALUES (
  '1db21814-5df2-47b3-9135-e6995fe70177',
  'SN1C6926',
  'SN1C692639 - GOMMONE DI ALFREDO',
  'Macchine Operatici e Carrelli',
  'NATANTE',
  'CONTO PROPRIO',
  'NA',
  '14',
  3000,
  2500,
  1500,
  0,
  95,
  70,
  0,
  0
);

-- INSERT premi_garanzia_polizza
INSERT INTO public.premi_garanzia_polizza (
  titolo_id, garanzia, firma, rata, annuo
) VALUES (
  '1db21814-5df2-47b3-9135-e6995fe70177',
  'RC',
  152.03,
  152.03,
  0
);

-- INSERT conducenti_polizza
INSERT INTO public.conducenti_polizza (
  titolo_id, nome, cognome, indirizzo, cap, citta, provincia
) VALUES (
  '1db21814-5df2-47b3-9135-e6995fe70177',
  'CANTIERE NAVALE BASILIO',
  'POSTIGLIONE SRL',
  'VIA LUCULLO, 4',
  '80070',
  'BACOLI',
  'NA'
);
