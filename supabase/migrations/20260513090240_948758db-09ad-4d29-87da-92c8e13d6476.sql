ALTER TABLE public.clienti RENAME COLUMN codice_cup TO codice_cig;
COMMENT ON COLUMN public.clienti.codice_cig IS 'Codice CIG (Codice Identificativo Gara) - obbligatorio per clienti tipo Ente';