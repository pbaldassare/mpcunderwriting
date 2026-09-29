-- Demo ospedale pubblico — portale cliente (clone pattern Comune di Varese)
-- Credenziali: protocollo@medical.it / Leone123! (provisioning via edge function seed-ospedale-demo)
-- Esclusione report: WHERE numero_titolo NOT LIKE 'DEMO-OS-%' AND numero_sinistro NOT LIKE 'SIN-OS-%'

-- UUID fissi per idempotenza
-- Cliente: c9f5a3b1-7e4d-5f8a-0c2b-3d4e5f6a7b81
-- User (auth): b8e4f2a0-6d3c-4f7e-9b1a-2c3d4e5f6a70 — creato dalla edge function

DO $$
DECLARE
  v_cliente uuid := 'c9f5a3b1-7e4d-5f8a-0c2b-3d4e5f6a7b81';
  v_ufficio uuid := '327e92f7-64f0-48b9-9e48-73611d8cb406';
  v_gf uuid;
  v_generali uuid;
  v_allianz uuid;
  v_lloyds uuid;
  v_nobis uuid;
  v_unipol uuid;
  v_ramo_rcp uuid := '7dc539de-9e42-4753-b05a-d60167c76aaf';
  v_ramo_property uuid := 'dbbd0609-d604-45a5-affb-c83d2d50913e';
  v_ramo_infortuni uuid := 'f3478e36-2d2a-4827-9a56-a059c826ce14';
  v_ramo_rca uuid := '21b2a2d6-9545-496a-9cb0-247674ba2a91';
  v_ramo_tutela uuid := '993a51c3-ac45-4531-a80a-917b2dcc0d9d';
  v_ramo_cyber uuid := 'f479640c-7722-4700-8914-236fcb1ec9bb';
  v_ramo_rcto uuid := 'd9b03bc6-c566-4659-b28b-0e9c0ac56588';
  v_ramo_ar uuid := 'fd34f9a2-3665-4e5d-be22-f25d6721c6c4';
  v_backoffice uuid := 'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18';
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; v_t5 uuid;
  v_t6 uuid; v_t7 uuid; v_t8 uuid;
BEGIN
  SELECT id INTO v_gf FROM public.gruppi_finanziari WHERE codice = 'AZ_SAN_PUB' LIMIT 1;

  -- Lookup compagnie (UUID fissi non portabili tra ambienti)
  SELECT id INTO v_generali FROM public.compagnie WHERE attiva = true AND nome ILIKE '%GENERALI%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_allianz FROM public.compagnie WHERE attiva = true AND nome ILIKE '%allianz%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_unipol FROM public.compagnie WHERE attiva = true AND nome ILIKE '%UNIPOL%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_nobis FROM public.compagnie
    WHERE attiva = true AND (nome ILIKE '%nobis%' OR nome ILIKE '%CHUBB%' OR nome ILIKE '%GROUPAMA%')
    ORDER BY nome LIMIT 1;
  SELECT id INTO v_lloyds FROM public.compagnie
    WHERE attiva = true AND (nome ILIKE '%lloyd%' OR nome ILIKE '%AIG%' OR nome ILIKE '%LIBERTY%' OR nome ILIKE '%FURNESS%')
    ORDER BY nome LIMIT 1;
  IF v_nobis IS NULL THEN SELECT id INTO v_nobis FROM public.compagnie WHERE attiva = true LIMIT 1; END IF;
  IF v_lloyds IS NULL THEN SELECT id INTO v_lloyds FROM public.compagnie WHERE attiva = true AND id <> COALESCE(v_nobis, '00000000-0000-0000-0000-000000000000'::uuid) LIMIT 1; END IF;
  IF v_generali IS NULL OR v_allianz IS NULL THEN
    RAISE EXCEPTION 'Compagnie demo non trovate — verificare anagrafica compagnie attive';
  END IF;
  IF v_unipol IS NULL THEN v_unipol := v_generali; END IF;

  INSERT INTO public.clienti (
    id, tipo_cliente, tipo_persona, ragione_sociale,
    partita_iva, codice_fiscale_azienda, forma_giuridica,
    indirizzo_sede, cap_sede, citta_sede, provincia_sede,
    email, pec, telefono, codice_sdi,
    ufficio_id, gruppo_finanziario_id,
    attivo, stato_cliente, area_riservata_tipo,
    codice_ricerca, settore, nazione, note,
    spec_sx_sanita, num_dipendenti
  ) VALUES (
    v_cliente, 'ente', 'giuridica',
    'Azienda Ospedaliera Universitaria Demo',
    '12345678901', '12345678901', 'Azienda Sanitaria Pubblica',
    'Via Francesco Sforza 35', '20122', 'Milano', 'MI',
    'protocollo@medical.it', 'protocollo@pec.medical.it', '02 55031', 'M5UXCR1',
    v_ufficio, v_gf,
    true, 'attivo', 'completa',
    'OSPEDALE_DEMO', 'Sanità pubblica', 'Italia',
    '[DEMO] Ospedale pubblico demo per portale cliente — dati simulati. Responsabile: Dott.ssa Elena Marini. PEC sinistri: sinistri@pec.medical.it.',
    'RC medica, malpractice, RCT/O, infortuni dipendenti, cyber cartelle cliniche',
    1850
  )
  ON CONFLICT (id) DO UPDATE SET
    ragione_sociale = EXCLUDED.ragione_sociale,
    email = EXCLUDED.email,
    pec = EXCLUDED.pec,
    gruppo_finanziario_id = EXCLUDED.gruppo_finanziario_id,
    area_riservata_tipo = 'completa',
    note = EXCLUDED.note,
    spec_sx_sanita = EXCLUDED.spec_sx_sanita,
    attivo = true,
    updated_at = now();

  -- Codice commerciale (stesso backoffice del Comune demo)
  INSERT INTO public.codici_commerciali_cliente (cliente_id, profilo_id, ruolo, societa_brand, filiale)
  SELECT v_cliente, v_backoffice, 'Backoffice', 'Consulbrokers', 'SEDE SAN DONA'' DI PIAVE'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.codici_commerciali_cliente
    WHERE cliente_id = v_cliente AND profilo_id = v_backoffice
  );

  -- Polizze demo (batch 2025 — senza PDF, visibili in dashboard)
  INSERT INTO public.titoli (
    numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
    premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
    durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tipo_portafoglio, rate, note
  )
  SELECT * FROM (VALUES
    ('DEMO-OS-2025-001', v_cliente, v_ufficio, v_generali, v_ramo_rcp,
      42000::numeric, 38200::numeric, 3800::numeric, 'attivo', 'RC Medica e Malpractice — personale sanitario e strutture',
      'RC Medica Ospedaliera', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza demo ospedale pubblico'),
    ('DEMO-OS-2025-002', v_cliente, v_ufficio, v_nobis, v_ramo_rcto,
      28500::numeric, 25900::numeric, 2600::numeric, 'attivo', 'RCT/O Ente Sanitario Pubblico',
      'RC Generale Enti Pubblici (RCT/O)', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza demo ospedale pubblico'),
    ('DEMO-OS-2025-003', v_cliente, v_ufficio, v_generali, v_ramo_infortuni,
      15600::numeric, 14200::numeric, 1400::numeric, 'attivo', 'Infortuni cumulativa dipendenti sanitari e amministrativi',
      'Infortuni Dipendenti', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza demo ospedale pubblico'),
    ('DEMO-OS-2025-004', v_cliente, v_ufficio, v_allianz, v_ramo_property,
      52000::numeric, 47300::numeric, 4700::numeric, 'attivo', 'All Risks patrimonio ospedaliero — padiglioni, TAC, risonanza',
      'All Risks Property', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza demo ospedale pubblico'),
    ('DEMO-OS-2025-005', v_cliente, v_ufficio, v_lloyds, v_ramo_cyber,
      11800::numeric, 10700::numeric, 1100::numeric, 'attivo', 'Cyber Risk — protezione cartelle cliniche e sistemi informativi ospedalieri',
      'Cyber Risk Sanità', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza demo ospedale pubblico')
  ) AS v(numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
         premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
         durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tipo_portafoglio, rate, note)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.titoli t
    WHERE t.numero_titolo = v.numero_titolo AND t.cliente_anagrafica_id = v_cliente
  );

  -- Polizze demo 2026 (con PDF via edge function seed-ospedale-demo)
  INSERT INTO public.titoli (
    numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
    premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
    durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tacito_rinnovo, tipo_portafoglio, rate, note
  )
  SELECT * FROM (VALUES
    ('DEMO-OS-2026-010', v_cliente, v_ufficio, v_allianz, v_ramo_ar,
      38500::numeric, 35000::numeric, 3500::numeric, 'attivo', 'All Risks Patrimonio Ospedaliero — Polizza K26IT018901',
      'All Risks Property', '2024-09-30'::date, '2026-09-30'::date, '2026-09-30'::date, '2024-09-30'::date, '2026-09-30'::date, 'annuale', false, 'diretto', 1,
      '[DEMO] Caricata da PDF esempio per Ospedale Demo'),
    ('DEMO-OS-2026-011', v_cliente, v_ufficio, v_generali, v_ramo_tutela,
      5200::numeric, 4700::numeric, 500::numeric, 'attivo', 'Tutela Legale Enti Sanitari Pubblici — Polizza G00232999',
      'Tutela Legale Enti Pubblici', '2023-09-30'::date, '2026-09-30'::date, '2026-09-30'::date, '2023-09-30'::date, '2026-09-30'::date, 'annuale', true, 'diretto', 1,
      '[DEMO] Caricata da PDF esempio per Ospedale Demo'),
    ('DEMO-OS-2026-012', v_cliente, v_ufficio, v_unipol, v_ramo_cyber,
      6200::numeric, 5600::numeric, 600::numeric, 'attivo', 'Cyber Risk Sanità — Polizza 196204088',
      'Cyber Risk Pubblica Amministrazione', '2023-09-30'::date, '2026-09-30'::date, '2026-09-30'::date, '2023-09-30'::date, '2026-09-30'::date, 'annuale', true, 'diretto', 1,
      '[DEMO] Caricata da PDF esempio per Ospedale Demo'),
    ('DEMO-OS-2026-013', v_cliente, v_ufficio, v_nobis, v_ramo_rcto,
      19800::numeric, 18000::numeric, 1800::numeric, 'attivo', 'RC Generale Ente Sanitario (RCT/O) — Polizza 203351880',
      'RC Generale Enti Pubblici (RCT/O)', '2023-09-30'::date, '2026-09-30'::date, '2026-09-30'::date, '2023-09-30'::date, '2026-09-30'::date, 'annuale', true, 'diretto', 1,
      '[DEMO] Caricata da PDF esempio per Ospedale Demo'),
    ('DEMO-OS-2026-014', v_cliente, v_ufficio, v_allianz, v_ramo_rca,
      22400::numeric, 20400::numeric, 2000::numeric, 'attivo', 'RCA Parco ambulanze e mezzi sanitari (12 mezzi)',
      'Libro Matricola RCA', '2025-06-01'::date, '2026-05-31'::date, '2026-06-15'::date, '2025-06-01'::date, '2026-05-31'::date, 'annuale', false, 'diretto', 1,
      '[DEMO] Scadenza imminente — parco ambulanze')
  ) AS v(numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
         premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
         durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tacito_rinnovo, tipo_portafoglio, rate, note)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.titoli t
    WHERE t.numero_titolo = v.numero_titolo AND t.cliente_anagrafica_id = v_cliente
  );

  SELECT id INTO v_t1 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2025-001' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t2 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2025-002' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t3 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2025-003' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t4 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2025-004' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t5 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2025-005' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t6 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2026-014' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t7 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2026-012' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t8 FROM public.titoli WHERE numero_titolo = 'DEMO-OS-2026-010' AND cliente_anagrafica_id = v_cliente;

  -- Sinistri demo
  DELETE FROM public.sinistri
  WHERE cliente_anagrafica_id = v_cliente
    AND numero_sinistro LIKE 'SIN-OS-%';

  INSERT INTO public.sinistri (
    numero_sinistro, cliente_anagrafica_id, ufficio_id, compagnia_id, titolo_id,
    stato, tipo_sinistro, ramo_sinistro, descrizione, dinamica,
    data_evento, data_apertura, data_denuncia,
    luogo_sinistro, citta_sinistro, provincia_sinistro, cap_sinistro,
    reparto,
    controparte, importo_riserva, importo_liquidato, costo_preventivato,
    numero_sinistro_compagnia, note_perito, data_chiusura
  ) VALUES
    ('SIN-OS-2025-001', v_cliente, v_ufficio, v_generali, v_t1,
      'aperto', 'RC Medica', 'RC Medica',
      'Richiesta risarcimento per presunta malpractice in sala operatoria',
      'Paziente ricoverato per intervento programmato — contestazione esito e danno biologico.',
      '2025-05-18', '2025-05-20', '2025-05-22',
      'Blocco Operatorio 3 — Padiglione Chirurgia', 'Milano', 'MI', '20122',
      'Chirurgia',
      'Sig.ra Anna Verdi', 85000, 0, 95000, 'GEN-2025-OS-0101', '[DEMO] Perizia medico-legale in corso', NULL),
    ('SIN-OS-2025-002', v_cliente, v_ufficio, v_generali, v_t3,
      'chiuso', 'Infortunio', 'Infortuni',
      'Infortunio infermiere durante movimentazione paziente',
      'Lesione lombare durante sollevamento assistito — prognosi 21 giorni.',
      '2025-03-10', '2025-03-11', '2025-03-12',
      'Reparto Ortopedia — Piano 4', 'Milano', 'MI', '20122',
      'Ortopedia',
      NULL, 0, 2800, 3200, 'GEN-2025-OS-0202', '[DEMO] Liquidato', '2025-06-15'),
    ('SIN-OS-2025-003', v_cliente, v_ufficio, v_allianz, v_t4,
      'in_lavorazione', 'Furto', 'Property',
      'Furto attrezzatura diagnostica da deposito temporaneo',
      'Sottrazione ecografo portatile e accessori — effrazione notturna.',
      '2025-07-02', '2025-07-03', '2025-07-04',
      'Deposito Tecnico — Via Lamarmora', 'Milano', 'MI', '20122',
      'Servizi Tecnici',
      'Ignoti', 0, 0, 18500, 'AZ-2025-OS-0303', '[DEMO] Denuncia Polizia, perito assegnato', NULL),
    ('SIN-OS-2025-004', v_cliente, v_ufficio, v_nobis, v_t2,
      'aperto', 'RC Terzi', 'RCT/O',
      'Caduta visitatore in corridoio reparto day hospital',
      'Paziente scivola su pavimento bagnato — contusioni multiple.',
      '2025-08-14', '2025-08-15', '2025-08-16',
      'Day Hospital — Padiglione A', 'Milano', 'MI', '20122',
      'Day Hospital',
      'Sig. Paolo Neri', 0, 0, 12000, 'NB-2025-OS-0404', '[DEMO] Attesa referti clinici', NULL),
    ('SIN-OS-2025-005', v_cliente, v_ufficio, v_lloyds, v_t5,
      'chiuso', 'Cyber', 'Cyber',
      'Accesso non autorizzato a cartelle cliniche elettroniche',
      'Compromissione credenziali utente — accesso a 47 cartelle, nessun dato esfiltrato confermato.',
      '2025-02-05', '2025-02-06', '2025-02-07',
      'Data Center Ospedaliero', 'Milano', 'MI', '20122',
      'IT / Sistemi Informativi',
      'Ignoti', 0, 8500, 10000, 'LL-2025-OS-0505', '[DEMO] Indennizzo spese ripristino e notifica Garante', '2025-04-20'),
    ('SIN-OS-2026-006', v_cliente, v_ufficio, v_allianz, v_t6,
      'aperto', 'Sinistro Stradale', 'RC Auto',
      'Tamponamento ambulanza durante trasporto urgente',
      'Veicolo terzo tampona ambulanza ferma al semaforo — danni materiali, nessun paziente ferito.',
      '2026-04-18', '2026-04-19', '2026-04-19',
      'Corso di Porta Romana / Via Ripamonti', 'Milano', 'MI', '20122',
      'Trasporto Sanitario',
      'Sig. Marco Bianchi — VW Golf AB456CD', 0, 0, 9800, 'AZ-2026-OS-0606', '[DEMO] Constatazione amichevole', NULL);

  -- Documenti demo (metadata — PDF caricati da edge function o placeholder path)
  DELETE FROM public.documenti
  WHERE entita_tipo = 'cliente' AND entita_id = v_cliente
    AND path_storage LIKE '%/demo-ospedale/%';

  INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
  VALUES
    ('cliente', v_cliente, 'Polizza_RC_Medica_2025.pdf', v_cliente || '/demo-ospedale/polizza_rc_medica.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Polizza_All_Risks_Ospedale_2025.pdf', v_cliente || '/demo-ospedale/polizza_allrisks.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Quietanza_Infortuni_Q1_2025.pdf', v_cliente || '/demo-ospedale/quietanza_inf.pdf', 'documenti_clienti', 'quietanza', true),
    ('cliente', v_cliente, 'Denuncia_SIN-OS-2025-001.pdf', v_cliente || '/demo-ospedale/denuncia_sin001.pdf', 'documenti_clienti', 'sinistro', true),
    ('cliente', v_cliente, 'Perizia_SIN-OS-2025-003.pdf', v_cliente || '/demo-ospedale/perizia_sin003.pdf', 'documenti_clienti', 'sinistro', true),
    ('cliente', v_cliente, 'Modulo_Privacy_Sanita_GDPR.pdf', v_cliente || '/demo-ospedale/privacy_gdpr.pdf', 'documenti_clienti', 'privacy', true),
    ('cliente', v_cliente, 'Accreditamento_Regione_Lombardia.pdf', v_cliente || '/demo-ospedale/accreditamento.pdf', 'documenti_clienti', 'amministrativo', true),
    ('cliente', v_cliente, 'Lettera_Circolare_Premi_2026.pdf', v_cliente || '/demo-ospedale/circolare_2026.pdf', 'documenti_clienti', 'comunicazione', true);

  IF v_t6 IS NOT NULL THEN
    INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
  VALUES
      ('titolo', v_t6, 'Certificato_Assicurazione_Ambulanze.pdf', v_cliente || '/demo-ospedale/cert_ambulanze.pdf', 'documenti_clienti', 'certificato', true);
  END IF;
  IF v_t7 IS NOT NULL THEN
    INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
    VALUES
      ('titolo', v_t7, 'Condizioni_Cyber_Risk_Sanita.pdf', v_cliente || '/demo-ospedale/cond_cyber.pdf', 'documenti_clienti', 'condizioni', true);
  END IF;
  IF v_t8 IS NOT NULL THEN
    INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
    VALUES
      ('titolo', v_t8, 'Set_Informativo_All_Risks_Ospedale.pdf', v_cliente || '/demo-ospedale/set_info_ar.pdf', 'documenti_clienti', 'set_informativo', true);
  END IF;

END $$;
