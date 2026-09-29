-- Merge dei 16 cluster gruppi_compagnia (alta + media confidenza)
-- Strategia: master = record con più agenzie collegate; descrizione finale in MAIUSCOLO
-- Riassegna le compagnie figlie e sincronizza il campo denormalizzato compagnie.gruppo_compagnia

-- Tabella temporanea con i merge da eseguire (master_id, legacy_id, master_descrizione_finale)
CREATE TEMP TABLE _merges (master_id uuid, legacy_id uuid, master_desc text) ON COMMIT DROP;

INSERT INTO _merges VALUES
  -- ALLIANZ
  ('38b9ef17-0af5-4ba5-8655-41a64636bec1','183060b0-434a-4d77-9a06-bdef5b236147','ALLIANZ'),
  -- AMISSIMA
  ('875b09ae-327f-4a84-b680-26957b5001bf','648fe7b0-24a0-4822-9bc5-327d9ad6a544','AMISSIMA'),
  -- ARAG
  ('07bd8736-2892-4697-ae6b-282e0b86a89c','b51a5fe0-d95a-439a-951b-8e5c03232c90','ARAG'),
  -- AXA
  ('9f8774c8-bd49-4b5d-b8fa-0dcaa87f0dab','a9843516-1151-4a89-a65a-4733cef89365','AXA'),
  -- BENE
  ('a78ed75c-e174-4229-b462-fb9358b7390d','1d5d8a43-9723-4e8c-973b-894f1388d9e4','BENE'),
  -- CATTOLICA
  ('8c30ea1a-f778-4533-8911-18d63b3d27c0','433d313e-385e-42ba-8f4e-a96a793293d7','CATTOLICA'),
  -- CHUBB
  ('d0a1ef06-1f6a-48a5-bcb5-0e569fd2be71','5f42b5b8-3e72-4dab-be89-dcb7a2b33fc1','CHUBB'),
  -- COFACE
  ('7467ef54-0a78-4b94-b873-7aee27fdb67b','6f8d12c5-46d1-48ef-89ad-0fb9204c3347','COFACE'),
  -- DAS
  ('028b2f6b-1b42-4992-956c-ddd3fea3eb00','3c012325-71b6-4ef5-833e-d11b3794884b','DAS'),
  -- GENERALI ITALIA (parità 10/10: master = GC065 più vecchio)
  ('be80cf91-fec3-4bdc-bf71-61feca6bd8db','02a3c121-b8a2-4a02-ad24-07be9a23e431','GENERALI ITALIA'),
  -- HELVETIA
  ('c4527cf6-d040-41c2-9e72-ad3f3053f1ea','82f5206e-5ad3-4515-8dc3-32742cd9d3f3','HELVETIA'),
  -- REALE MUTUA
  ('64cd2896-03e7-449d-be5b-b7824daaabbd','ebd326e7-184d-4956-8001-ba842ac27dbd','REALE MUTUA'),
  -- S2C
  ('d32a9b14-09a3-4f16-8284-aa0aa81a1de6','3e6d09fb-dcb4-4292-8692-77beb32c3e1a','S2C'),
  -- EUROP ASSISTANCE
  ('0acf2ef6-0873-4e60-ad60-7497cf2c4685','c207c428-7ba6-48e1-a46e-f6350b971dfe','EUROP ASSISTANCE ITALIA'),
  -- ASSICURATRICE MILANESE
  ('f9463f8c-2bc9-439a-9c5f-bf1064f5fbd9','c75936f2-cae7-4211-94e8-ef276a40b7bf','ASSICURATRICE MILANESE'),
  -- COMP. ESTERE
  ('d2d3d42e-30d8-49e8-b71c-e3f67f466f23','2099e944-e7cb-46e1-b90a-bb9214ebb3cb','COMP. ESTERE');

-- 1) Riassegna le compagnie figlie dal legacy al master
UPDATE compagnie c
SET gruppo_compagnia_id = m.master_id
FROM _merges m
WHERE c.gruppo_compagnia_id = m.legacy_id;

-- 2) Aggiorna la descrizione del master in maiuscolo (prima di eliminare i legacy per evitare conflitti con l'unique index ci)
-- Step intermedio: imposta descrizione legacy temporanea per evitare collisione case-insensitive con master
UPDATE gruppi_compagnia g
SET descrizione = '__TO_DELETE__' || g.id::text
FROM _merges m
WHERE g.id = m.legacy_id;

UPDATE gruppi_compagnia g
SET descrizione = m.master_desc
FROM _merges m
WHERE g.id = m.master_id;

-- 3) Sincronizza il campo denormalizzato compagnie.gruppo_compagnia
UPDATE compagnie c
SET gruppo_compagnia = g.descrizione
FROM gruppi_compagnia g
WHERE c.gruppo_compagnia_id = g.id;

-- 4) Elimina i record legacy (ora privi di figli)
DELETE FROM gruppi_compagnia g
USING _merges m
WHERE g.id = m.legacy_id;