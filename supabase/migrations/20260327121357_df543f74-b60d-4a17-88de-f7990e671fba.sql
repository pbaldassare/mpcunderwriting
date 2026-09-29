ALTER TABLE rami ADD COLUMN IF NOT EXISTS aliquota_tasse_ramo numeric DEFAULT 0;
ALTER TABLE rami ADD COLUMN IF NOT EXISTS aliquota_tasse_ard numeric DEFAULT 0;