
-- Update existing 5 sinistri
UPDATE sinistri SET
  ramo_sinistro = 'R.C.T./O.',
  dinamica = 'Infiltrazione acqua piovana dal tetto del palazzo comunale con allagamento uffici al piano terra. Danni a mobili, computer e documenti.',
  indirizzo_sinistro = 'Via Luigi Sacco 5',
  citta_sinistro = 'Varese',
  provincia_sinistro = 'VA',
  cap_sinistro = '21100',
  data_denuncia = '2025-01-20',
  controparte = NULL,
  franchigia = 500,
  numero_sinistro_compagnia = 'UNI-2025-VA-00147',
  costo_preventivato = 18000,
  note_perito = 'Accertato danno da infiltrazione. Stima danni conforme.'
WHERE id = '2f861302-9ce4-480c-a727-66c56e50cc05';

UPDATE sinistri SET
  ramo_sinistro = 'INFORTUNI',
  dinamica = 'Dipendente comunale scivolato sulle scale interne durante orario di lavoro. Frattura polso destro.',
  indirizzo_sinistro = 'Via Luigi Sacco 5',
  citta_sinistro = 'Varese',
  provincia_sinistro = 'VA',
  cap_sinistro = '21100',
  data_denuncia = '2024-11-10',
  medico_legale = 'Dott. Marco Bianchi',
  franchigia = 0,
  numero_sinistro_compagnia = 'GEN-2024-INF-03291',
  costo_preventivato = 12000,
  costo_effettivo = 8500,
  note_perito = 'Perizia medica completata. Invalidità temporanea 45 giorni.'
WHERE id = '7500821f-8886-47f6-8f82-d6cd4313cda3';

UPDATE sinistri SET
  ramo_sinistro = 'KASKO',
  dinamica = 'Furto di veicolo comunale Fiat Ducato targato VA 123 AB dal parcheggio di Via Magenta durante la notte.',
  indirizzo_sinistro = 'Via Magenta 12',
  citta_sinistro = 'Varese',
  provincia_sinistro = 'VA',
  cap_sinistro = '21100',
  data_denuncia = '2025-02-16',
  targa_veicolo = 'VA 123 AB',
  franchigia = 1000,
  numero_sinistro_compagnia = 'UNI-2025-FUR-00089',
  costo_preventivato = 28000,
  note_perito = 'Veicolo non ancora ritrovato. Denuncia alle autorità effettuata.'
WHERE id = '104c882f-988d-4408-8d3e-7f4c43cdfc4f';

UPDATE sinistri SET
  ramo_sinistro = 'R.C.T./O.',
  dinamica = 'Caduta albero in area pubblica su autovettura privata in sosta. Danni al veicolo e lesioni lievi al proprietario.',
  indirizzo_sinistro = 'Viale Belforte 24',
  citta_sinistro = 'Varese',
  provincia_sinistro = 'VA',
  cap_sinistro = '21100',
  data_denuncia = '2025-03-06',
  medico_legale = 'Dott.ssa Elena Colombo',
  controparte = 'Rossi Mario - CF RSSMRA75A01L682Q',
  franchigia = 250,
  numero_sinistro_compagnia = 'ZUR-2025-RCT-01456',
  costo_preventivato = 35000,
  note_perito = 'Perizia in corso. Albero abbattuto per mancata manutenzione contestata.'
WHERE id = 'f7c71a9b-8604-4919-8897-58380d515eb4';

UPDATE sinistri SET
  ramo_sinistro = 'CYBER RISK',
  dinamica = 'Attacco ransomware ai sistemi informatici del Comune. Cifratura di 3 server e interruzione servizi online per 5 giorni.',
  indirizzo_sinistro = 'Via Luigi Sacco 5',
  citta_sinistro = 'Varese',
  provincia_sinistro = 'VA',
  cap_sinistro = '21100',
  data_denuncia = '2025-03-20',
  controparte = 'Ignoto',
  franchigia = 5000,
  numero_sinistro_compagnia = 'AXA-2025-CYB-00034',
  costo_preventivato = 85000,
  note_perito = 'Analisi forense in corso. Richiesta documentazione tecnica completa.'
WHERE id = '99b5e4ea-9130-4cc4-9b4e-dfb669deb426';

-- Insert 3 new sinistri
INSERT INTO sinistri (numero_sinistro, titolo_id, cliente_anagrafica_id, stato, data_apertura, data_chiusura, descrizione, tipo_sinistro, luogo_sinistro, data_evento, importo_riserva, importo_liquidato, ramo_sinistro, dinamica, indirizzo_sinistro, citta_sinistro, provincia_sinistro, cap_sinistro, data_denuncia, franchigia, numero_sinistro_compagnia, costo_preventivato, costo_effettivo, note_perito, targa_veicolo)
VALUES
  ('SIN-VA-2024-006', 'e6fa53ed-2e94-4d64-b21b-135a5b170ba3', '16f2caf6-c840-4b2c-b504-6968ca698ad7', 'chiuso', '2024-07-15', '2024-10-20', 'Grandine su parco auto comunale — danni a 4 veicoli', 'grandine', 'Varese', '2024-07-10', 0, 22000, 'KASKO', 'Forte grandinata con chicchi di 3cm. Danni a carrozzeria e cristalli di 4 veicoli comunali parcheggiati nel piazzale.', 'Piazzale De Gasperi 1', 'Varese', 'VA', '21100', '2024-07-12', 500, 'UNI-2024-GRA-00456', 25000, 22000, 'Perizia completata. Riparazione carrozzeria e sostituzione cristalli effettuata.', 'VA 456 CD, VA 789 EF, VA 012 GH, VA 345 IL'),
  ('SIN-VA-2025-007', '6b936612-b729-402b-82b0-0ddd6a93578e', '16f2caf6-c840-4b2c-b504-6968ca698ad7', 'aperto', '2025-03-25', NULL, 'Infortunio operaio manutenzione stradale', 'infortunio', 'Varese', '2025-03-22', 15000, 0, 'INFORTUNI', 'Operaio addetto alla manutenzione stradale caduto da scala durante potatura alberi. Trauma cranico lieve e frattura clavicola.', 'Via Caracciolo 18', 'Varese', 'VA', '21100', '2025-03-23', 0, 'GEN-2025-INF-00891', 20000, NULL, 'Perizia medica in corso.', NULL),
  ('SIN-VA-2025-008', '426cc822-44e8-4024-9b86-cff1038bb9f8', '16f2caf6-c840-4b2c-b504-6968ca698ad7', 'in_lavorazione', '2025-02-10', NULL, 'Danno patrimoniale per errore amministrativo su concessione edilizia', 'RC_terzi', 'Varese', '2025-01-28', 50000, 0, 'R.C. PATRIMONIALE', 'Rilascio erroneo di concessione edilizia che ha causato danni a terzi. Il cittadino ha costruito secondo concessione, successivamente annullata dal TAR.', 'Via Cavour 3', 'Varese', 'VA', '21100', '2025-02-05', 2500, 'ZUR-2025-RCP-00234', 120000, NULL, 'Causa in corso presso il Tribunale di Varese. Perizia legale richiesta.', NULL);
