
-- 1. Insert ufficio
INSERT INTO public.uffici (id, nome_ufficio, codice_ufficio, indirizzo, email, telefono, attivo)
VALUES (
  gen_random_uuid(),
  'SEDE SAN DONA'' DI PIAVE',
  'SDO',
  'Via Giobatta dall''Armi 3/2, 30027 San Donà di Piave (VE)',
  'consulbrokerssandona@pec-mail.it',
  '0421 307800',
  true
);

-- 2. Profile
INSERT INTO public.profiles (id, nome, cognome, email, ruolo, attivo)
VALUES (
  '746c540d-7e65-417d-9834-39612c13213a',
  'Comune di Varese', NULL,
  'protocollo@comune.varese.it', 'cliente', true
) ON CONFLICT (id) DO UPDATE SET ruolo = 'cliente';

-- 3. Cliente
INSERT INTO public.clienti (id, tipo_cliente, tipo_persona, ragione_sociale, partita_iva, codice_fiscale_azienda,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede, email, pec, telefono, codice_sdi,
  user_id, ufficio_id, attivo, stato_cliente, note, nazione, settore)
VALUES (
  gen_random_uuid(), 'ente', 'giuridica', 'Comune di Varese', '00291010121', '00291010121',
  'Via Sacco 5', '21100', 'Varese', 'VA',
  'protocollo@comune.varese.it', 'protocollo@pec.comune.varese.it', '0332 255111', 'UFZSRP',
  '746c540d-7e65-417d-9834-39612c13213a',
  (SELECT id FROM public.uffici WHERE codice_ufficio = 'SDO' LIMIT 1),
  true, 'attivo',
  'Ente Pubblico - Comune di ~80.000 abitanti. Responsabile sede: Maria Midena. PEC sinistri: uffsinistricbsandona@pec-mail.it. Orari: Lun-Gio 8:30-13:30/14:30-18:00, Ven 8:30-14:30.',
  'Italia', 'Pubblica Amministrazione'
);

-- 4. Update prospect
UPDATE public.prospect SET stato = 'chiuso_vinto',
  convertito_cliente_id = (SELECT id FROM public.clienti WHERE user_id = '746c540d-7e65-417d-9834-39612c13213a' LIMIT 1)
WHERE id = '68178b0a-6fd9-41cf-a74a-f09a91a5d5d4';

-- 5. Specialist ufficio
UPDATE public.profiles SET ufficio_id = (SELECT id FROM public.uffici WHERE codice_ufficio = 'SDO' LIMIT 1)
WHERE id = 'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18';

-- 6. Codice commerciale
INSERT INTO public.codici_commerciali_cliente (cliente_id, profilo_id, ruolo, societa_brand, filiale)
VALUES (
  (SELECT id FROM public.clienti WHERE user_id = '746c540d-7e65-417d-9834-39612c13213a' LIMIT 1),
  'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18', 'Backoffice', 'Consulbrokers', 'SEDE SAN DONA'' DI PIAVE'
);

-- 7. 8 polizze fake
DO $$
DECLARE
  v_cli uuid;
  v_uff uuid;
BEGIN
  SELECT id INTO v_cli FROM public.clienti WHERE user_id = '746c540d-7e65-417d-9834-39612c13213a' LIMIT 1;
  SELECT id INTO v_uff FROM public.uffici WHERE codice_ufficio = 'SDO' LIMIT 1;

  INSERT INTO public.titoli (numero_titolo, descrizione_polizza, prodotto_nome, cliente_anagrafica_id, compagnia_id, ramo_id, ufficio_id, specialist, filiale, premio_lordo, stato, durata_da, durata_a, garanzia_da, garanzia_a, tipo_portafoglio, periodicita, rate) VALUES
  ('VA-RCTO-2025-001','RCT/O Enti Pubblici','RCT/O Enti Pubblici',v_cli,'c152f68d-0bc1-412a-90ca-56940f48bf28','aaf435d1-85dc-4b93-9f52-b916d109a611',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',18500,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-INF-2025-002','Infortuni Cumulativa dipendenti','Infortuni Cumulativa',v_cli,'57df53bc-bf0f-4e78-851d-b867dfc0eb61','f3478e36-2d2a-4827-9a56-a059c826ce14',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',8200,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-KAS-2025-003','Kasko parco veicoli comunali','Kasko Veicoli',v_cli,'0678589e-61b3-4a5a-8c51-4d8371b781a2','7bfdf4f6-b011-4012-954f-34dd49e90ba8',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',4800,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-LM-2025-004','Libro Matricola dipendenti','Libro Matricola',v_cli,'a6c13e3d-3885-4af5-a9c1-4dfc86c53f76','f42d71cc-abe1-496c-bdcb-1850003ec985',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',12600,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-TL-2025-005','Tutela Legale amministratori','Tutela Legale',v_cli,'c152f68d-0bc1-412a-90ca-56940f48bf28','bb7cbeee-0e2d-4f6c-ac70-1f6c560b9490',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',6900,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-RCP-2025-006','RC Patrimoniale amministratori','RC Patrimoniale',v_cli,'7b1c10eb-0bd9-410e-aca7-492c616f71b8','e2f09c7f-43c5-482c-8be0-0fe064f4145c',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',9400,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-CYB-2025-007','Cyber Risk protezione dati','Cyber Risk',v_cli,'57df53bc-bf0f-4e78-851d-b867dfc0eb61','f479640c-7722-4700-8914-236fcb1ec9bb',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',7300,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1),
  ('VA-WEL-2025-008','Welfare dipendenti comunali','Welfare Dipendenti',v_cli,'bd13e472-aa67-4598-94fa-057275dcbe65','8d13b7c0-1850-4ec6-a36f-254f2c15eb6a',v_uff,'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18','SEDE SAN DONA'' DI PIAVE',5500,'attivo','2025-01-01','2026-01-01','2025-01-01','2026-01-01','gestione','annuale',1);
END $$;
