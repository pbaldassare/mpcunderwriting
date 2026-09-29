
DO $$
DECLARE
  v_titolo_id uuid;
BEGIN
  INSERT INTO titoli (
    numero_titolo, cliente_anagrafica_id, compagnia_id, ramo_id,
    durata_da, durata_a, tipo_rinnovo, valuta, stato,
    ufficio_id, targa_telaio, descrizione_polizza, premio_lordo
  ) VALUES (
    'AXKY13OP',
    '48498444-8930-4384-9f77-ecc7ba2741bb',
    'c350524e-b93c-46b0-aeff-8a0327c96abb',
    'c2c4d6b8-4eb3-4d13-8ce2-0c6f85d9d004',
    '2022-04-20', '2026-04-20',
    'Tacito rinnovo', 'EUR', 'creato',
    '68506cb3-3662-4967-bc88-8f5992f8efdc',
    'DA62414',
    'TG. DA62414 X MAX 250 - MAURIZIO',
    243.00
  ) RETURNING id INTO v_titolo_id;

  INSERT INTO movimenti_polizza (titolo_id, riga, appendice, data_movimento, data_effetto, data_scadenza, data_rinnovo, tipo_rinnovo, descrizione, valuta, premio, provvigioni, tipo, data_copertura, data_incasso, stato, ufficio_id)
  VALUES
    (v_titolo_id, 0, null, '2025-05-13', '2025-04-20', '2026-04-20', '2026-04-20', 'Tacito rinnovo', 'TG. DA62414 X MAX 250 - MAURIZIO', 'EUR', 243.00, 20.00, 'Polizza Quietanza', '2025-05-13', '2025-05-13', 'emesso', '68506cb3-3662-4967-bc88-8f5992f8efdc'),
    (v_titolo_id, 0, null, '2024-04-23', '2024-04-20', '2025-04-20', '2025-04-20', 'Tacito rinnovo', 'TG. DA62414 X MAX 250 - MAURIZIO', 'EUR', 204.00, 16.84, 'Polizza Quietanza', '2024-04-23', '2024-04-23', 'rinnovato', '68506cb3-3662-4967-bc88-8f5992f8efdc'),
    (v_titolo_id, 0, null, '2023-04-21', '2023-04-20', '2024-04-20', '2024-04-20', 'Tacito rinnovo', 'TG. DA62414 X MAX 250 - MAURIZIO', 'EUR', 185.00, 15.34, 'Polizza Quietanza', '2023-04-21', '2023-04-21', 'rinnovato', '68506cb3-3662-4967-bc88-8f5992f8efdc'),
    (v_titolo_id, 0, null, '2022-04-20', '2022-04-20', '2023-04-20', '2023-04-20', 'Tacito rinnovo', 'TG. DA62414 X MAX 250 - MAURIZIO', 'EUR', 176.00, 14.61, 'Polizza Base', '2022-04-20', '2022-04-20', 'rinnovato', '68506cb3-3662-4967-bc88-8f5992f8efdc');
END $$;
