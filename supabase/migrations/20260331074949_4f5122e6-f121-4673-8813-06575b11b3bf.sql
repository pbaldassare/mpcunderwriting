
-- Extend lookup_tipo_documento with all columns from Excel
ALTER TABLE lookup_tipo_documento
  ADD COLUMN IF NOT EXISTS visibile boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clienti boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compagnie boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS polizze boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trattative boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrattuali boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prod boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS firma text,
  ADD COLUMN IF NOT EXISTS firma_avanzata text,
  ADD COLUMN IF NOT EXISTS smart_anchors text,
  ADD COLUMN IF NOT EXISTS box_firma_1 text,
  ADD COLUMN IF NOT EXISTS box_firma_2 text,
  ADD COLUMN IF NOT EXISTS box_firma_3 text,
  ADD COLUMN IF NOT EXISTS box_firma_4 text,
  ADD COLUMN IF NOT EXISTS clausole_particolari text,
  ADD COLUMN IF NOT EXISTS pos_clausole text;
