ALTER TABLE clienti ADD COLUMN IF NOT EXISTS cig_temporaneo boolean NOT NULL DEFAULT false;
ALTER TABLE titoli ADD COLUMN IF NOT EXISTS cig_temporaneo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_clienti_cig_temp ON clienti(cig_temporaneo) WHERE cig_temporaneo = true;
CREATE INDEX IF NOT EXISTS idx_titoli_cig_temp ON titoli(cig_temporaneo) WHERE cig_temporaneo = true;