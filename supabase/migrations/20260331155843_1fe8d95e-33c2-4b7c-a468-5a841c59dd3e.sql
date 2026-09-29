
-- Update 8 polizze with enriched data
UPDATE titoli SET 
  data_scadenza = '2026-01-15', durata_da = '2025-01-15', periodicita = 'annuale',
  premio_netto = 15200.00, tasse = 3300.00, data_competenza = '2025-01-15',
  descrizione_polizza = 'Responsabilità Civile verso Terzi e Operai - Copertura completa per danni a terzi durante attività istituzionali e cantieri',
  data_incasso = '2025-01-20', stato = 'attivo', importo_incassato = 18500.00
WHERE numero_titolo = 'VA-RCTO-2025-001';

UPDATE titoli SET 
  data_scadenza = '2026-03-01', durata_da = '2025-03-01', periodicita = 'annuale',
  premio_netto = 6700.00, tasse = 1500.00, data_competenza = '2025-03-01',
  descrizione_polizza = 'Infortuni Cumulativa Dipendenti - Copertura infortuni per tutto il personale comunale',
  data_incasso = '2025-03-05', stato = 'attivo', importo_incassato = 8200.00
WHERE numero_titolo = 'VA-INF-2025-002';

UPDATE titoli SET 
  data_scadenza = '2026-06-15', durata_da = '2025-06-15', periodicita = 'annuale',
  premio_netto = 3900.00, tasse = 900.00, data_competenza = '2025-06-15',
  descrizione_polizza = 'Kasko Veicoli Comunali - Copertura danni al parco auto e mezzi operativi',
  data_incasso = '2025-06-20', stato = 'attivo', importo_incassato = 4800.00
WHERE numero_titolo = 'VA-KAS-2025-003';

UPDATE titoli SET 
  data_scadenza = '2026-04-01', durata_da = '2025-04-01', periodicita = 'annuale',
  premio_netto = 10300.00, tasse = 2300.00, data_competenza = '2025-04-01',
  descrizione_polizza = 'Libro Matricola - Copertura assicurativa dipendenti iscritti a libro matricola',
  data_incasso = '2025-04-10', stato = 'attivo', importo_incassato = 12600.00
WHERE numero_titolo = 'VA-LM-2025-004';

UPDATE titoli SET 
  data_scadenza = '2026-02-01', durata_da = '2025-02-01', periodicita = 'annuale',
  premio_netto = 5600.00, tasse = 1300.00, data_competenza = '2025-02-01',
  descrizione_polizza = 'Tutela Legale Ente Pubblico - Copertura spese legali per controversie amministrative e civili',
  data_incasso = '2025-02-10', stato = 'attivo', importo_incassato = 6900.00
WHERE numero_titolo = 'VA-TL-2025-005';

UPDATE titoli SET 
  data_scadenza = '2026-05-01', durata_da = '2025-05-01', periodicita = 'annuale',
  premio_netto = 7700.00, tasse = 1700.00, data_competenza = '2025-05-01',
  descrizione_polizza = 'RC Patrimoniale Amministratori - Responsabilità patrimoniale dirigenti e funzionari',
  data_incasso = '2025-05-08', stato = 'attivo', importo_incassato = 9400.00
WHERE numero_titolo = 'VA-RCP-2025-006';

UPDATE titoli SET 
  data_scadenza = '2026-07-01', durata_da = '2025-07-01', periodicita = 'annuale',
  premio_netto = 5900.00, tasse = 1400.00, data_competenza = '2025-07-01',
  descrizione_polizza = 'Cyber Risk Protection - Protezione contro attacchi informatici, data breach e ransomware',
  data_incasso = '2025-07-05', stato = 'attivo', importo_incassato = 7300.00
WHERE numero_titolo = 'VA-CYB-2025-007';

UPDATE titoli SET 
  data_scadenza = '2026-09-01', durata_da = '2025-09-01', periodicita = 'annuale',
  premio_netto = 4500.00, tasse = 1000.00, data_competenza = '2025-09-01',
  descrizione_polizza = 'Welfare Dipendenti - Piano assicurativo welfare aziendale per i dipendenti comunali',
  data_incasso = '2025-09-03', stato = 'attivo', importo_incassato = 5500.00
WHERE numero_titolo = 'VA-WEL-2025-008';

-- Insert 5 sinistri fake
INSERT INTO sinistri (numero_sinistro, tipo_sinistro, data_evento, data_apertura, luogo_sinistro, descrizione, importo_riserva, importo_liquidato, costo_preventivato, stato, cliente_anagrafica_id, titolo_id, compagnia_id, ufficio_id) VALUES
('SIN-VA-2025-001','danni_acqua','2025-04-12','2025-04-15','Palazzo Estense, Via Sacco 5, Varese','Rottura tubatura al secondo piano del Palazzo Estense con allagamento uffici anagrafe e danni a documenti e attrezzature informatiche',15000.00,0,18000.00,'aperto','16f2caf6-c840-4b2c-b504-6968ca698ad7','6fe76c88-5115-425f-8849-91eadb4fb20e','c152f68d-0bc1-412a-90ca-56940f48bf28',(SELECT ufficio_id FROM titoli WHERE numero_titolo='VA-RCTO-2025-001')),
('SIN-VA-2025-002','infortunio','2025-02-20','2025-02-22','Cantiere Via Magenta, Varese','Infortunio sul lavoro di un operaio durante lavori di manutenzione stradale - frattura avambraccio',3200.00,3200.00,3500.00,'chiuso','16f2caf6-c840-4b2c-b504-6968ca698ad7','6b936612-b729-402b-82b0-0ddd6a93578e','57df53bc-bf0f-4e78-851d-b867dfc0eb61',(SELECT ufficio_id FROM titoli WHERE numero_titolo='VA-INF-2025-002')),
('SIN-VA-2025-003','furto','2025-06-05','2025-06-06','Magazzino Comunale Via Dalmazia, Varese','Furto di attrezzature e utensili dal magazzino comunale - effrazione notturna con forzatura serratura',8500.00,0,9200.00,'in_lavorazione','16f2caf6-c840-4b2c-b504-6968ca698ad7','e6fa53ed-2e94-4d64-b21b-135a5b170ba3','0678589e-61b3-4a5a-8c51-4d8371b781a2',(SELECT ufficio_id FROM titoli WHERE numero_titolo='VA-KAS-2025-003')),
('SIN-VA-2025-004','RC_terzi','2025-08-10','2025-08-12','Piazza Monte Grappa, Varese','Scivolamento cittadino su pavimentazione dissestata davanti al municipio - trauma cranico e contusioni multiple',22000.00,0,28000.00,'aperto','16f2caf6-c840-4b2c-b504-6968ca698ad7','6fe76c88-5115-425f-8849-91eadb4fb20e','c152f68d-0bc1-412a-90ca-56940f48bf28',(SELECT ufficio_id FROM titoli WHERE numero_titolo='VA-RCTO-2025-001')),
('SIN-VA-2025-005','altro','2025-09-18','2025-09-20','Data Center Comunale, Varese','Attacco ransomware ai sistemi informatici comunali con crittografia di database anagrafici e blocco servizi online per 48 ore',12000.00,0,15000.00,'in_attesa_documenti','16f2caf6-c840-4b2c-b504-6968ca698ad7','053d214e-7388-4b7b-bb03-4170941ccafb','57df53bc-bf0f-4e78-851d-b867dfc0eb61',(SELECT ufficio_id FROM titoli WHERE numero_titolo='VA-CYB-2025-007'));
