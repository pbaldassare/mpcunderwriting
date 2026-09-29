-- Migration: Add indexes for performance-critical tables

-- titoli
CREATE INDEX IF NOT EXISTS idx_titoli_stato ON titoli(stato);
CREATE INDEX IF NOT EXISTS idx_titoli_data_scadenza ON titoli(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_titoli_cliente_id ON titoli(cliente_id);
CREATE INDEX IF NOT EXISTS idx_titoli_compagnia_id ON titoli(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_titoli_data_messa_cassa ON titoli(data_messa_cassa);

-- sinistri
CREATE INDEX IF NOT EXISTS idx_sinistri_stato ON sinistri(stato);
CREATE INDEX IF NOT EXISTS idx_sinistri_data_apertura ON sinistri(data_apertura);
CREATE INDEX IF NOT EXISTS idx_sinistri_cliente_id ON sinistri(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sinistri_compagnia_id ON sinistri(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_sinistri_data_chiusura ON sinistri(data_chiusura);

-- provvigioni_generate
CREATE INDEX IF NOT EXISTS idx_provvigioni_generate_titolo_id ON provvigioni_generate(titolo_id);
CREATE INDEX IF NOT EXISTS idx_provvigioni_generate_data ON provvigioni_generate(data);

-- trattative
CREATE INDEX IF NOT EXISTS idx_trattative_titolo_id ON trattative(titolo_id);
CREATE INDEX IF NOT EXISTS idx_trattative_data ON trattative(data);
