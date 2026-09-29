
DO $$
DECLARE
  v_cliente uuid := '94dc5a3c-1682-4aea-a9e2-190bf8bf34b1';
  v_ufficio uuid := '327e92f7-64f0-48b9-9e48-73611d8cb406';
  v_generali uuid := '3b7d5b9e-f8eb-439c-a1cd-c38789f49d1f';
  v_allianz uuid := '2d21455d-ab46-480a-bf01-4f21fda9b6d0';
  v_lloyds uuid := '9bd1eeb8-9c2f-4f9e-8ba4-ad7d5d527f3f';
  v_ramo_rca uuid := '21b2a2d6-9545-496a-9cb0-247674ba2a91';
  v_ramo_property uuid := 'dbbd0609-d604-45a5-affb-c83d2d50913e';
  v_ramo_infortuni uuid := 'f3478e36-2d2a-4827-9a56-a059c826ce14';
  v_ramo_rcg uuid := '7dc539de-9e42-4753-b05a-d60167c76aaf';
  v_t6 uuid; v_t7 uuid; v_t8 uuid; v_t9 uuid;
  v_t1 uuid := '9e3b5de6-7a5d-43f7-9a78-3866dd6afeb4';
  v_t2 uuid := '84a73746-e884-41a8-b390-487bda7927de';
BEGIN
  INSERT INTO public.titoli (numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id, prodotto_nome, descrizione_polizza, premio_lordo, premio_netto, tasse, addizionali, durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, stato, tipo_portafoglio, rate, note)
  VALUES
    ('DEMO-VA-2026-006', v_cliente, v_ufficio, v_allianz, v_ramo_rca, 'RCA Scuolabus', 'RC Auto Parco Scuolabus 8 mezzi', 14200, 11500, 2300, 400, '2025-06-01', '2026-05-31', '2025-06-01', '2026-05-31', '2026-06-15', 'attivo', 'diretto', 1, '[DEMO] Scadenza imminente'),
    ('DEMO-VA-2026-007', v_cliente, v_ufficio, v_lloyds, v_ramo_property, 'Cyber Risk PA', 'Polizza Cyber Risk Pubblica Amministrazione', 9800, 7900, 1600, 300, '2025-07-01', '2026-06-30', '2025-07-01', '2026-06-30', '2026-07-05', 'attivo', 'diretto', 1, '[DEMO]'),
    ('DEMO-VA-2025-008', v_cliente, v_ufficio, v_generali, v_ramo_infortuni, 'Kasko Amministratori', 'Kasko Amministratori e Dipendenti in missione', 4200, 3400, 700, 100, '2024-09-01', '2025-08-31', '2024-09-01', '2025-08-31', '2025-08-31', 'scaduto', 'diretto', 1, '[DEMO] Scaduta da rinnovare'),
    ('DEMO-VA-2026-009', v_cliente, v_ufficio, v_generali, v_ramo_rcg, 'D&O Amministratori', 'D&O Responsabilità Amministratori e Sindaci', 7600, 6100, 1300, 200, '2026-01-01', '2026-12-31', '2026-01-01', '2026-12-31', '2026-12-31', 'attivo', 'diretto', 1, '[DEMO]');

  SELECT id INTO v_t6 FROM public.titoli WHERE numero_titolo='DEMO-VA-2026-006';
  SELECT id INTO v_t7 FROM public.titoli WHERE numero_titolo='DEMO-VA-2026-007';
  SELECT id INTO v_t8 FROM public.titoli WHERE numero_titolo='DEMO-VA-2025-008';
  SELECT id INTO v_t9 FROM public.titoli WHERE numero_titolo='DEMO-VA-2026-009';

  INSERT INTO public.sinistri (numero_sinistro, cliente_anagrafica_id, ufficio_id, compagnia_id, titolo_id, stato, tipo_sinistro, descrizione, dinamica, data_evento, data_apertura, data_denuncia, luogo_sinistro, citta_sinistro, provincia_sinistro, cap_sinistro, controparte, importo_liquidato, importo_riserva, costo_preventivato, numero_sinistro_compagnia, note_perito, data_chiusura)
  VALUES
    ('SIN-VA-2026-005', v_cliente, v_ufficio, v_allianz, v_t2, 'aperto', 'Furto', 'Furto attrezzatura informatica uffici comunali', 'Effrazione notturna ingresso secondario, asportati 12 PC e 3 server', '2026-03-15', '2026-03-16', '2026-03-16', 'Sede Comune di Varese - Via Sacco 5', 'Varese', 'VA', '21100', 'Ignoti', 0, 8500, 9000, 'AZ-2026-VA-0451', '[DEMO] Denuncia Carabinieri, perito assegnato', NULL),
    ('SIN-VA-2026-006', v_cliente, v_ufficio, v_generali, v_t1, 'in_lavorazione', 'RC Patrimoniale', 'Contestazione appalto opere pubbliche', 'Ricorso TAR per illegittimità provvedimento, danno patrimoniale richiesto', '2026-02-10', '2026-02-12', '2026-02-15', 'TAR Lombardia', 'Milano', 'MI', '20121', 'ATI Costruzioni Lombardia Srl', 0, 25000, 30000, 'GEN-2026-VA-0089', '[DEMO] Avv. Bianchi assegnato, attesa udienza', NULL),
    ('SIN-VA-2026-007', v_cliente, v_ufficio, v_allianz, v_t6, 'aperto', 'Sinistro Stradale', 'Tamponamento scuolabus durante trasporto alunni', 'Veicolo terzo ha tamponato lo scuolabus fermo a semaforo', '2026-04-22', '2026-04-23', '2026-04-23', 'Via Manzoni / Cavour - Varese', 'Varese', 'VA', '21100', 'Mario Rossi - Fiat Panda AB123CD', 0, 12000, 12500, 'AZ-2026-VA-0782', '[DEMO] Constatazione amichevole, nessun ferito grave', NULL),
    ('SIN-VA-2026-008', v_cliente, v_ufficio, v_lloyds, v_t7, 'chiuso', 'Cyber', 'Attacco ransomware sistemi anagrafe', 'Cifratura server anagrafe, ripristino da backup', '2026-01-20', '2026-01-21', '2026-01-21', 'Datacenter Comune', 'Varese', 'VA', '21100', 'Ignoti - gruppo LockBit', 18000, 0, 20000, 'LL-2026-CY-0034', '[DEMO] Ripristino completato, indennizzo liquidato', '2026-02-28');

  INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
  VALUES
    ('cliente', v_cliente, 'Polizza_RC_Patrimoniale_2025.pdf', v_cliente||'/demo/polizza_rcp_2025.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Polizza_All_Risks_2025.pdf', v_cliente||'/demo/polizza_allrisks_2025.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Quietanza_Infortuni_Q1_2025.pdf', v_cliente||'/demo/quietanza_inf_q1.pdf', 'documenti_clienti', 'quietanza', true),
    ('cliente', v_cliente, 'Denuncia_SIN-VA-2025-001.pdf', v_cliente||'/demo/denuncia_sin001.pdf', 'documenti_clienti', 'sinistro', true),
    ('cliente', v_cliente, 'Perizia_SIN-VA-2025-004.pdf', v_cliente||'/demo/perizia_sin004.pdf', 'documenti_clienti', 'sinistro', true),
    ('cliente', v_cliente, 'Modulo_Privacy_GDPR.pdf', v_cliente||'/demo/privacy_gdpr.pdf', 'documenti_clienti', 'privacy', true),
    ('cliente', v_cliente, 'Visura_Camerale_Comune.pdf', v_cliente||'/demo/visura_camerale.pdf', 'documenti_clienti', 'amministrativo', true),
    ('cliente', v_cliente, 'Lettera_Circolare_Premi_2026.pdf', v_cliente||'/demo/circolare_2026.pdf', 'documenti_clienti', 'comunicazione', true),
    ('titolo', v_t6, 'Certificato_Assicurazione_Scuolabus.pdf', v_cliente||'/demo/cert_scuolabus.pdf', 'documenti_clienti', 'certificato', true),
    ('titolo', v_t7, 'Condizioni_Cyber_Risk.pdf', v_cliente||'/demo/cond_cyber.pdf', 'documenti_clienti', 'condizioni', true),
    ('titolo', v_t9, 'Set_Informativo_DandO.pdf', v_cliente||'/demo/set_info_do.pdf', 'documenti_clienti', 'set_informativo', true),
    ('titolo', v_t8, 'Disdetta_Kasko_2025.pdf', v_cliente||'/demo/disdetta_kasko.pdf', 'documenti_clienti', 'disdetta', true);
END $$;
