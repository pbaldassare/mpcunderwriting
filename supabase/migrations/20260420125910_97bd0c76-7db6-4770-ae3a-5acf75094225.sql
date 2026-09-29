-- 1) Estendi il check constraint stato (mantenendo 'annullato' già presente nei dati)
ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_stato_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_stato_check
  CHECK (stato IN ('attivo','sospeso','scaduto','incassato','annullato','in_attesa_rinnovo'));

-- 2) Indice di supporto per il trigger
CREATE INDEX IF NOT EXISTS idx_titoli_sostituisce_lookup
  ON public.titoli (sostituisce_polizza, sostituisce_riga, stato)
  WHERE stato = 'in_attesa_rinnovo';

-- 3) Funzione + trigger: quando un titolo passa a 'incassato',
--    promuove i rinnovi figli da 'in_attesa_rinnovo' a 'attivo'
CREATE OR REPLACE FUNCTION public.attiva_rinnovo_su_messa_cassa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stato = 'incassato'
     AND (OLD.stato IS DISTINCT FROM 'incassato')
     AND NEW.numero_titolo IS NOT NULL THEN
    UPDATE public.titoli
       SET stato = 'attivo',
           updated_at = now()
     WHERE sostituisce_polizza = NEW.numero_titolo
       AND (
         (NEW.riga IS NULL AND sostituisce_riga IS NULL)
         OR sostituisce_riga = NEW.riga
       )
       AND stato = 'in_attesa_rinnovo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attiva_rinnovo_su_messa_cassa ON public.titoli;
CREATE TRIGGER trg_attiva_rinnovo_su_messa_cassa
AFTER UPDATE OF stato ON public.titoli
FOR EACH ROW
EXECUTE FUNCTION public.attiva_rinnovo_su_messa_cassa();