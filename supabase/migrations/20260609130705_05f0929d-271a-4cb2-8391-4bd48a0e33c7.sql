-- Backfill: clienti con almeno una polizza/quietanza → stato_cliente='attivo' se vuoto
UPDATE public.clienti
SET stato_cliente = 'attivo'
WHERE (stato_cliente IS NULL OR stato_cliente = '')
  AND EXISTS (SELECT 1 FROM public.titoli t WHERE t.cliente_id = clienti.id);

-- Trigger: ogni nuova polizza/quietanza forza stato_cliente='attivo' se vuoto
CREATE OR REPLACE FUNCTION public.trg_titoli_set_cliente_attivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    UPDATE public.clienti
       SET stato_cliente = 'attivo'
     WHERE id = NEW.cliente_id
       AND (stato_cliente IS NULL OR stato_cliente = '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_set_cliente_attivo ON public.titoli;
CREATE TRIGGER trg_titoli_set_cliente_attivo
AFTER INSERT ON public.titoli
FOR EACH ROW EXECUTE FUNCTION public.trg_titoli_set_cliente_attivo();