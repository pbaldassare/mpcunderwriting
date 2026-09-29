-- Estende libro_matricola_mezzi con campi veicolo (tipologia, descrizione, uso, immatricolazione).

ALTER TABLE public.libro_matricola_mezzi
  ADD COLUMN IF NOT EXISTS tipologia text,
  ADD COLUMN IF NOT EXISTS descrizione text,
  ADD COLUMN IF NOT EXISTS uso text,
  ADD COLUMN IF NOT EXISTS data_immatricolazione date;

COMMENT ON COLUMN public.libro_matricola_mezzi.tipologia IS 'Tipologia mezzo (es. Autovettura, Furgone)';
COMMENT ON COLUMN public.libro_matricola_mezzi.descrizione IS 'Descrizione libera del mezzo';
COMMENT ON COLUMN public.libro_matricola_mezzi.uso IS 'Uso del mezzo (es. privato, terzi)';
COMMENT ON COLUMN public.libro_matricola_mezzi.data_immatricolazione IS 'Data di immatricolazione del mezzo';
