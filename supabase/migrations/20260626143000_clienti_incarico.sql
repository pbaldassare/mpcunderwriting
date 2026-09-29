-- Campi incarico su anagrafica clienti (privato, azienda, ente)
ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS ha_incarico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incarico_da date NULL,
  ADD COLUMN IF NOT EXISTS incarico_a date NULL;

COMMENT ON COLUMN public.clienti.ha_incarico IS 'Indica se il cliente ha un incarico attivo o registrato';
COMMENT ON COLUMN public.clienti.incarico_da IS 'Data inizio incarico';
COMMENT ON COLUMN public.clienti.incarico_a IS 'Data fine incarico';
