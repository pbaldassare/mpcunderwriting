
ALTER TABLE public.rimessa_premi
  ADD COLUMN IF NOT EXISTS iban_utilizzato TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento_rimessa DATE,
  ADD COLUMN IF NOT EXISTS n_titoli INTEGER,
  ADD COLUMN IF NOT EXISTS totale_provvigioni NUMERIC;
