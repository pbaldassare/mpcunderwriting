DO $$
DECLARE
  v_user_id uuid := '746c540d-7e65-417d-9834-39612c13213a';
  v_prospect_id uuid := '68178b0a-6fd9-41cf-a74a-f09a91a5d5d4';
  v_ufficio_id uuid := '327e92f7-64f0-48b9-9e48-73611d8cb406';
  v_cli_id uuid := gen_random_uuid();
  v_generali uuid := '3b7d5b9e-f8eb-439c-a1cd-c38789f49d1f';
  v_allianz uuid := '2d21455d-ab46-480a-bf01-4f21fda9b6d0';
  v_lloyds uuid := '9bd1eeb8-9c2f-4f9e-8ba4-ad7d5d527f3f';
  v_ramo_rcp uuid := '7dc539de-9e42-4753-b05a-d60167c76aaf';
  v_ramo_inc uuid := 'dbbd0609-d604-45a5-affb-c83d2d50913e';
  v_ramo_inf uuid := 'f3478e36-2d2a-4827-9a56-a059c826ce14';
  v_ramo_rca uuid := '21b2a2d6-9545-496a-9cb0-247674ba2a91';
  v_ramo_tg  uuid := '993a51c3-ac45-4531-a80a-917b2dcc0d9d';
  v_t1 uuid := gen_random_uuid();
  v_t2 uuid := gen_random_uuid();
  v_t3 uuid := gen_random_uuid();
  v_t4 uuid := gen_random_uuid();
  v_t5 uuid := gen_random_uuid();
BEGIN

INSERT INTO clienti (
  id, tipo_cliente, ragione_sociale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, indirizzo_sede, cap_sede, citta_sede, provincia_sede,
  pec, telefono, email, ufficio_id, user_id, codice_cup, attivo, codice_ricerca, note
) VALUES (
  v_cli_id, 'ente', 'Comune di Varese', '00441340120', '00441340120',
  'Ente Pubblico', 'Via Sacco 5', '21100', 'Varese', 'VA',
  'protocollo@comune.varese.it', '0332 255111', 'protocollo@comune.it',
  v_ufficio_id, v_user_id, 'DEMO-VA-001', true, 'COMUNE_VARESE',
  '[DEMO] Utenza demo ente per portale cliente'
);

UPDATE prospect
SET convertito_cliente_id = v_cli_id, cliente_associato = true, stato = 'chiuso_vinto'
WHERE id = v_prospect_id;

UPDATE profiles SET ruolo='cliente' WHERE id = v_user_id;

INSERT INTO titoli (id, numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
  premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
  durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, note) VALUES
(v_t1, 'DEMO-VA-2025-001', v_cli_id, v_ufficio_id, v_generali, v_ramo_rcp,
  18500, 16800, 1700, 'attivo', 'RC Patrimoniale Amministratori e Dirigenti',
  'RC Patrimoniale', '2025-01-01', '2025-12-31', '2025-12-31', '2025-01-01', '2025-12-31',
  '[DEMO] Polizza demo Comune di Varese'),
(v_t2, 'DEMO-VA-2025-002', v_cli_id, v_ufficio_id, v_allianz, v_ramo_inc,
  42000, 38200, 3800, 'attivo', 'All Risks Patrimonio Comunale',
  'All Risks Property', '2025-01-01', '2025-12-31', '2025-12-31', '2025-01-01', '2025-12-31',
  '[DEMO] Polizza demo Comune di Varese'),
(v_t3, 'DEMO-VA-2025-003', v_cli_id, v_ufficio_id, v_generali, v_ramo_inf,
  12300, 11200, 1100, 'attivo', 'Infortuni cumulativa dipendenti',
  'Infortuni Dipendenti', '2025-01-01', '2025-12-31', '2025-12-31', '2025-01-01', '2025-12-31',
  '[DEMO] Polizza demo Comune di Varese'),
(v_t4, 'DEMO-VA-2025-004', v_cli_id, v_ufficio_id, v_allianz, v_ramo_rca,
  28700, 26100, 2600, 'attivo', 'RCA Parco Veicoli Comunali (45 mezzi)',
  'Libro Matricola RCA', '2025-03-01', '2026-02-28', '2026-02-28', '2025-03-01', '2026-02-28',
  '[DEMO] Polizza demo Comune di Varese'),
(v_t5, 'DEMO-VA-2025-005', v_cli_id, v_ufficio_id, v_lloyds, v_ramo_tg,
  6500, 5900, 600, 'attivo', 'Tutela Legale Ente',
  'Tutela Giudiziaria', '2025-01-01', '2025-12-31', '2025-12-31', '2025-01-01', '2025-12-31',
  '[DEMO] Polizza demo Comune di Varese');

INSERT INTO sinistri (id, numero_sinistro, titolo_id, cliente_anagrafica_id, compagnia_id, ufficio_id,
  stato, ramo_sinistro, tipo_sinistro, data_apertura, data_evento, data_denuncia,
  descrizione, dinamica, luogo_sinistro, citta_sinistro, provincia_sinistro,
  importo_riserva, importo_liquidato, costo_preventivato, controparte, targa_veicolo) VALUES
(gen_random_uuid(), 'SIN-VA-2025-001', v_t1, v_cli_id, v_generali, v_ufficio_id,
  'aperto', 'RC Patrimoniale', 'Responsabilità', '2025-04-12', '2025-04-05', '2025-04-08',
  'Richiesta risarcimento per atto amministrativo contestato',
  'Ricorso al TAR Lombardia da parte di società appaltatrice esclusa da gara pubblica per servizi di manutenzione del verde.',
  'Sede comunale - Via Sacco 5', 'Varese', 'VA',
  15000, 0, 18000, 'Verde Servizi S.r.l.', NULL),
(gen_random_uuid(), 'SIN-VA-2025-002', v_t3, v_cli_id, v_generali, v_ufficio_id,
  'chiuso', 'Infortuni', 'Infortunio sul lavoro', '2025-02-20', '2025-02-15', '2025-02-17',
  'Infortunio dipendente ufficio anagrafe',
  'Caduta accidentale dipendente in ufficio per pavimento bagnato non segnalato. Frattura polso destro, prognosi 35 giorni.',
  'Ufficio Anagrafe - P.zza Monte Grappa', 'Varese', 'VA',
  0, 3200, 4000, NULL, NULL),
(gen_random_uuid(), 'SIN-VA-2025-003', v_t4, v_cli_id, v_allianz, v_ufficio_id,
  'in_lavorazione', 'RC Auto', 'Sinistro Stradale', '2025-05-10', '2025-05-08', '2025-05-09',
  'Tamponamento mezzo comunale',
  'Mezzo della Polizia Locale tampona autovettura ferma al semaforo in Via Magenta. Danni materiali ad entrambe le vetture, nessun ferito.',
  'Via Magenta angolo Corso Matteotti', 'Varese', 'VA',
  4800, 0, 5200, 'Sig. Mario Bianchi (FIAT Punto)', 'YA123BC'),
(gen_random_uuid(), 'SIN-VA-2025-004', v_t2, v_cli_id, v_allianz, v_ufficio_id,
  'chiuso', 'Incendio/Danni', 'Danno acqua', '2025-01-22', '2025-01-18', '2025-01-19',
  'Allagamento Biblioteca Civica',
  'Rottura tubazione acqua fredda al piano superiore della Biblioteca Civica con danni a circa 200 volumi del fondo storico e arredi.',
  'Biblioteca Civica - Via Sacco 9', 'Varese', 'VA',
  0, 22000, 25000, NULL, NULL);

END $$;