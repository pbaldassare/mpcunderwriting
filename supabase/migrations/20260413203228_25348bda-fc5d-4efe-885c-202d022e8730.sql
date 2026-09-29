
-- Reinserire polizza 6131402092 per aprile 2026
INSERT INTO titoli (
  numero_titolo, stato, premio_lordo, premio_netto, tasse, 
  data_scadenza, durata_da, durata_a, garanzia_da, garanzia_a,
  compagnia_id, ramo_id, cliente_anagrafica_id,
  specialist, ae_nome, produttore_nome, filiale,
  provvigioni_firma, provvigioni_quietanza,
  periodicita, percentuale_riparto, percentuale_commerciale,
  tipo_rinnovo, tipo_incasso, conto_incasso, valuta, cambio,
  anni_durata, disdetta_mesi, mora_giorni, rate, riga,
  descrizione_polizza, gruppo_ramo, libro_matricola,
  comp_assicurativa, comp_contabile, data_competenza, data_incasso,
  id_legacy, addizionali, addizionali_quietanza,
  emissione_fee, formato_elettronico, indicizzata, no_calcolo_tasse,
  pag_diretto_compagnia, regolazione, rimborso
) VALUES (
  '6131402092', 'attivo', 63050.22, 55615.34, 7434.88,
  '2026-04-30', '2025-04-30', '2026-04-30', '2025-04-30', '2026-04-30',
  '9feab29d-8d2c-4235-aa94-6055fb481a87', '3475af3c-90ab-43bf-9258-840bed242db2', 'fe446bf7-7abc-4dbb-9199-4435b14ef37c',
  'GUARRACINO GAETANO', 'SEDE NAPOLI', 'INTERFIDI SRL', 'NA',
  2609.86, 1043.94,
  'annuale', 100, 100,
  'R', 'C', 'Incasso diretto Compagnia', 'EURO', 1,
  1, 0, 15, 1, 0,
  'RCA LIBRO MATRICOLA + INFORTUNI CONDUCENTE', 'R.C.A.', 'no',
  '2025-04-30', '2025-04-30', '2025-05-10', '2025-05-10',
  142628, 0, 0,
  false, false, false, false,
  false, false, false
);

-- Reinserire polizza RCM00010074404 per aprile 2026
INSERT INTO titoli (
  numero_titolo, stato, premio_lordo, premio_netto, tasse,
  data_scadenza, durata_da, durata_a, garanzia_da, garanzia_a,
  compagnia_id, ramo_id, cliente_anagrafica_id,
  specialist, ae_nome, produttore_nome, filiale,
  provvigioni_firma, provvigioni_quietanza,
  periodicita, percentuale_riparto, percentuale_commerciale,
  tipo_rinnovo, tipo_incasso, conto_incasso, valuta, cambio,
  anni_durata, disdetta_mesi, mora_giorni, rate, riga,
  gruppo_ramo, libro_matricola,
  comp_assicurativa, comp_contabile, data_competenza, data_incasso,
  id_legacy, addizionali, addizionali_quietanza,
  emissione_fee, formato_elettronico, indicizzata, no_calcolo_tasse,
  pag_diretto_compagnia, regolazione, rimborso
) VALUES (
  'RCM00010074404', 'attivo', 750, 613.49, 136.51,
  '2026-04-19', '2026-01-19', '2027-01-19', '2026-01-19', '2026-04-19',
  '7f7eb941-d228-483c-a578-034b6bac0582', '502176d5-8595-4d98-b451-67cbd4f9c3fe', '6e60fe40-472b-4402-9206-747b6bdd71dc',
  'Gestione Milano', 'SEDE NAPOLI', 'Consulbrokers Digital Srl', 'NA',
  110.43, 110.43,
  'annuale', 100, 100,
  'R', 'X', 'BCC COMP 3292', 'EURO', 1,
  1, 0, 15, 3, 0,
  'R.C.T.', 'no',
  '2026-01-19', '2026-01-19', '2026-01-05', '2026-02-10',
  161593, 0, 0,
  false, false, false, false,
  false, false, false
);
