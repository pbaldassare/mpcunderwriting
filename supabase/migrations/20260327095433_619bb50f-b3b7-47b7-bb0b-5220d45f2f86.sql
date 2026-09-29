
-- 1. Creare compagnia ASSISA
INSERT INTO compagnie (codice, nome, nome_sede, attiva)
VALUES ('ASSISA', 'ASSISUD DI GREGORIO ANGELO & C. SAS', 'Sede Principale', true);

-- 2. Inserire titolo + movimenti + veicolo + premi garanzia
DO $$
DECLARE
  v_compagnia_id uuid;
  v_titolo_id uuid;
BEGIN
  SELECT id INTO v_compagnia_id FROM compagnie WHERE codice = 'ASSISA' LIMIT 1;
  v_titolo_id := gen_random_uuid();

  INSERT INTO titoli (
    id, numero_titolo, riga, appendice,
    cliente_anagrafica_id, compagnia_id, ramo_id, gruppo_ramo,
    specialist, ufficio_id,
    descrizione_polizza, targa_telaio,
    durata_da, durata_a, anni_durata,
    garanzia_da, garanzia_a,
    rate, tipo_rinnovo, mora_giorni, disdetta_mesi,
    premio_netto, addizionali, tasse, premio_lordo,
    provvigioni_firma,
    premio_netto_quietanza, addizionali_quietanza, tasse_quietanza,
    provvigioni_quietanza,
    stato
  ) VALUES (
    v_titolo_id, '332434490', 0, '000',
    '2451d38a-6e64-4890-b3e4-f0b6624bdc3d', v_compagnia_id, 'fbd5eab1-f574-4604-85fd-a7ee9a6fc0e3', 'RCA',
    'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18', '68506cb3-3662-4967-bc88-8f5992f8efdc',
    'PASSAT TG. FA637ZA - NICOLA PIROVANO', 'FA637ZA',
    '2024-04-17', '2026-04-17', 2,
    '2024-04-17', '2025-04-17',
    1, 'Tacito rinnovo', 15, 2,
    417.34, 196.64, 136.02, 750.00,
    57.48,
    447.36, 196.64, 140.00,
    59.44,
    'creato'
  );

  -- Movimento 1: Polizza Base (anno 1) - incassato/rinnovato
  INSERT INTO movimenti_polizza (
    titolo_id, riga, appendice,
    data_movimento, data_effetto, data_scadenza, data_rinnovo,
    tipo, descrizione,
    premio, provvigioni,
    stato, incassato, ufficio_id
  ) VALUES (
    v_titolo_id, 0, '000',
    '2024-04-17', '2024-04-17', '2025-04-17', '2025-04-17',
    'Polizza Base', 'Polizza Base - Anno 1',
    750.00, 57.48,
    'rinnovato', true, '68506cb3-3662-4967-bc88-8f5992f8efdc'
  );

  -- Movimento 2: Quietanza (anno 2) - da incassare
  INSERT INTO movimenti_polizza (
    titolo_id, riga, appendice,
    data_movimento, data_effetto, data_scadenza, data_rinnovo,
    tipo, descrizione,
    premio, provvigioni,
    stato, incassato, ufficio_id
  ) VALUES (
    v_titolo_id, 0, '000',
    '2025-04-23', '2025-04-17', '2026-04-17', '2026-04-17',
    'Quietanza', 'Quietanza Rinnovo - Anno 2',
    784.00, 59.44,
    'da_incassare', false, '68506cb3-3662-4967-bc88-8f5992f8efdc'
  );

  -- Dati veicolo
  INSERT INTO veicoli_polizza (
    titolo_id, settore, tipo_veicolo, uso,
    marca, modello,
    targa, veicolo_descrizione,
    provincia_circolazione, classe_bm,
    cv, kw, cc, posti
  ) VALUES (
    v_titolo_id, 'Autovetture', 'AUTOVETTURA', 'PRIVATO',
    'Volkswagen', 'Passat V',
    'FA637ZA', 'PASSAT TG. FA637ZA - NICOLA PIROVANO',
    'Potenza', '11',
    20, 110, 0, 5
  );

  -- Premi per garanzia (7 righe)
  INSERT INTO premi_garanzia_polizza (titolo_id, garanzia, capitale, tasso, firma, rata, annuo, ordine) VALUES
    (v_titolo_id, 'RC', 0, 0, 447.36, 447.36, 0, 1),
    (v_titolo_id, 'Furto/Incendio/Eventi', 13000, 0, 163.91, 163.91, 0, 2),
    (v_titolo_id, 'Tutela Legale', 0, 0, 0, 0, 0, 3),
    (v_titolo_id, 'ARD (varie)', 0, 0, 0, 0, 0, 4),
    (v_titolo_id, 'Kasko/Cristalli', 0, 0, 0, 0, 0, 5),
    (v_titolo_id, 'Ass. Stradale', 0, 0, 32.73, 32.73, 0, 6),
    (v_titolo_id, 'Infortuni', 0, 0, 0, 0, 0, 7);

END $$;
