
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS descrizione text,
  ADD COLUMN IF NOT EXISTS indirizzo text,
  ADD COLUMN IF NOT EXISTS cap varchar(10),
  ADD COLUMN IF NOT EXISTS citta text,
  ADD COLUMN IF NOT EXISTS provincia varchar(2),
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS fax text,
  ADD COLUMN IF NOT EXISTS codice_fiscale text,
  ADD COLUMN IF NOT EXISTS nome_rui text,
  ADD COLUMN IF NOT EXISTS data_iscrizione_rui date,
  ADD COLUMN IF NOT EXISTS numero_rui text,
  ADD COLUMN IF NOT EXISTS sezione_rui text,
  ADD COLUMN IF NOT EXISTS codice_contabile text,
  ADD COLUMN IF NOT EXISTS percentuale_ra numeric(5,2),
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS intestatario_cc text;
