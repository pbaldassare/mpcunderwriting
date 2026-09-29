
ALTER TABLE titoli ADD COLUMN IF NOT EXISTS data_messa_cassa date;
ALTER TABLE titoli ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE titoli ADD COLUMN IF NOT EXISTS data_decorrenza_rinnovo date;

DROP VIEW IF EXISTS v_portafoglio_titoli;

CREATE VIEW v_portafoglio_titoli AS
SELECT
  t.*,
  c.nome AS compagnia_nome,
  c.codice AS compagnia_codice,
  r.descrizione AS ramo_descrizione,
  r.codice AS ramo_codice,
  cl.cognome AS cliente_cognome,
  cl.nome AS cliente_nome,
  cl.ragione_sociale AS cliente_ragione_sociale,
  cl.codice_fiscale AS cliente_codice_fiscale,
  cl.tipo_cliente AS cliente_tipo,
  u.nome_ufficio
FROM titoli t
LEFT JOIN compagnie c ON c.id = t.compagnia_id
LEFT JOIN rami r ON r.id = t.ramo_id
LEFT JOIN prodotti p ON p.id = t.prodotto_id
LEFT JOIN clienti cl ON cl.id = t.cliente_anagrafica_id
LEFT JOIN uffici u ON u.id = t.ufficio_id;
