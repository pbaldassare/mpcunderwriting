ALTER TABLE public.sinistri DROP CONSTRAINT sinistri_stato_check;
ALTER TABLE public.sinistri ADD CONSTRAINT sinistri_stato_check
  CHECK (stato IN ('in_valutazione','aperto','in_lavorazione','in_attesa_documenti','in_liquidazione','chiuso','respinto'));