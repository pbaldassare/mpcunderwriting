
-- 1) Allow client to insert sinistri in stato 'in_valutazione' or 'aperto'
DROP POLICY IF EXISTS "Cliente insert own sinistro" ON public.sinistri;
CREATE POLICY "Cliente insert own sinistro"
ON public.sinistri
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND (cliente_anagrafica_id IN (SELECT get_my_cliente_ids()))
  AND (aperto_da_cliente = true)
  AND (stato IN ('in_valutazione','aperto'))
);

-- 2) Trigger: auto-popola cliente_anagrafica_id e ufficio_id da titolo
CREATE OR REPLACE FUNCTION public.trg_sinistri_autopop_cliente_ufficio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_ufficio uuid;
BEGIN
  IF NEW.titolo_id IS NOT NULL AND (NEW.cliente_anagrafica_id IS NULL OR NEW.ufficio_id IS NULL) THEN
    SELECT cliente_anagrafica_id, ufficio_id INTO v_cliente, v_ufficio
    FROM public.titoli WHERE id = NEW.titolo_id;
    IF NEW.cliente_anagrafica_id IS NULL THEN NEW.cliente_anagrafica_id := v_cliente; END IF;
    IF NEW.ufficio_id IS NULL THEN NEW.ufficio_id := v_ufficio; END IF;
  END IF;

  -- Se ancora manca l'ufficio ma c'è il cliente, prendi dal cliente
  IF NEW.ufficio_id IS NULL AND NEW.cliente_anagrafica_id IS NOT NULL THEN
    SELECT ufficio_id INTO v_ufficio FROM public.clienti WHERE id = NEW.cliente_anagrafica_id;
    NEW.ufficio_id := v_ufficio;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sinistri_autopop ON public.sinistri;
CREATE TRIGGER trg_sinistri_autopop
BEFORE INSERT OR UPDATE ON public.sinistri
FOR EACH ROW EXECUTE FUNCTION public.trg_sinistri_autopop_cliente_ufficio();

-- 3) Backfill record esistenti
UPDATE public.sinistri s
SET cliente_anagrafica_id = COALESCE(s.cliente_anagrafica_id, t.cliente_anagrafica_id),
    ufficio_id = COALESCE(s.ufficio_id, t.ufficio_id)
FROM public.titoli t
WHERE s.titolo_id = t.id
  AND (s.cliente_anagrafica_id IS NULL OR s.ufficio_id IS NULL);

UPDATE public.sinistri s
SET ufficio_id = c.ufficio_id
FROM public.clienti c
WHERE s.cliente_anagrafica_id = c.id
  AND s.ufficio_id IS NULL
  AND c.ufficio_id IS NOT NULL;
