-- 1. Add structured date column
ALTER TABLE public.anagrafiche_professionali 
  ADD COLUMN IF NOT EXISTS data_iscrizione_rui date;

-- 2. Backfill from existing text values (ISO timestamps)
UPDATE public.anagrafiche_professionali
   SET data_iscrizione_rui = (iscrizione_rui::timestamp)::date
 WHERE iscrizione_rui IS NOT NULL 
   AND TRIM(iscrizione_rui) <> ''
   AND data_iscrizione_rui IS NULL
   AND iscrizione_rui ~ '^\d{4}-\d{2}-\d{2}';

-- 3. Sync trigger: keep legacy text column populated as dd/mm/yyyy
CREATE OR REPLACE FUNCTION public.sync_iscrizione_rui_text()
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public 
AS $$
BEGIN
  IF NEW.data_iscrizione_rui IS NOT NULL THEN
    NEW.iscrizione_rui := to_char(NEW.data_iscrizione_rui, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_iscrizione_rui ON public.anagrafiche_professionali;
CREATE TRIGGER trg_sync_iscrizione_rui
BEFORE INSERT OR UPDATE ON public.anagrafiche_professionali
FOR EACH ROW EXECUTE FUNCTION public.sync_iscrizione_rui_text();