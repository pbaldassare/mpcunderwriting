ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS archiviata BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_trattative_archiviata ON public.trattative(archiviata);