ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS codice_cup text;
COMMENT ON COLUMN public.clienti.codice_cup IS 'Codice CUP (Codice Unico di Progetto) - obbligatorio per clienti tipo Ente';