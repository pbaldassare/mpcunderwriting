ALTER TABLE titoli
  ADD COLUMN IF NOT EXISTS conferimento_gestito boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fondi_ricevuti boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_conferimento_gestito date;