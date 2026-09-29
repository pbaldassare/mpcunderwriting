-- Aggiungo colonna tipo_soggetto a gruppi_finanziari
ALTER TABLE public.gruppi_finanziari
  ADD COLUMN IF NOT EXISTS tipo_soggetto text NOT NULL DEFAULT 'azienda';

-- Pre-popolo i record esistenti basandomi su codice/descrizione
UPDATE public.gruppi_finanziari
SET tipo_soggetto = CASE
  WHEN codice IN ('LINEA_PERS','GF02') THEN 'privato'
  WHEN codice IN ('EPE','ENTE_AUT','IPAB','AZ_PART_PUB','AZ_SAN_PUB','GF03','GF04')
       OR codice LIKE 'EP\_%' ESCAPE '\'
       THEN 'ente'
  ELSE 'azienda'
END;

-- Vincolo di validità sui valori
ALTER TABLE public.gruppi_finanziari
  DROP CONSTRAINT IF EXISTS gruppi_finanziari_tipo_soggetto_check;
ALTER TABLE public.gruppi_finanziari
  ADD CONSTRAINT gruppi_finanziari_tipo_soggetto_check
  CHECK (tipo_soggetto IN ('privato','azienda','ente'));