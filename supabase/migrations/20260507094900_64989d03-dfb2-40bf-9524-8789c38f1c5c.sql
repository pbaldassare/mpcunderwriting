ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS vincolo_attivo boolean NOT NULL DEFAULT false;
UPDATE public.titoli SET vincolo_attivo = true WHERE vincolo IS NOT NULL AND btrim(vincolo) <> '';