
-- A) Estendi trigger per popolare anche compagnia_id
CREATE OR REPLACE FUNCTION public.trg_sinistri_autopop_cliente_ufficio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid;
  v_ufficio uuid;
  v_compagnia uuid;
BEGIN
  IF NEW.titolo_id IS NOT NULL THEN
    SELECT cliente_anagrafica_id, ufficio_id, compagnia_id
      INTO v_cliente, v_ufficio, v_compagnia
    FROM public.titoli WHERE id = NEW.titolo_id;
    IF NEW.cliente_anagrafica_id IS NULL THEN NEW.cliente_anagrafica_id := v_cliente; END IF;
    IF NEW.ufficio_id IS NULL THEN NEW.ufficio_id := v_ufficio; END IF;
    IF NEW.compagnia_id IS NULL THEN NEW.compagnia_id := v_compagnia; END IF;
  END IF;

  IF NEW.ufficio_id IS NULL AND NEW.cliente_anagrafica_id IS NOT NULL THEN
    SELECT ufficio_id INTO v_ufficio FROM public.clienti WHERE id = NEW.cliente_anagrafica_id;
    NEW.ufficio_id := v_ufficio;
  END IF;

  RETURN NEW;
END;
$function$;

-- B) Trigger AFTER INSERT per checklist di default
CREATE OR REPLACE FUNCTION public.trg_sinistri_default_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sinistro_checklist WHERE sinistro_id = NEW.id) THEN
    INSERT INTO public.sinistro_checklist (sinistro_id, descrizione, obbligatorio) VALUES
      (NEW.id, 'Denuncia sinistro compilata', true),
      (NEW.id, 'Documentazione fotografica', true),
      (NEW.id, 'Copia polizza allegata', true),
      (NEW.id, 'Modulo CID/CAI compilato', false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sinistri_default_checklist ON public.sinistri;
CREATE TRIGGER sinistri_default_checklist
  AFTER INSERT ON public.sinistri
  FOR EACH ROW EXECUTE FUNCTION public.trg_sinistri_default_checklist();

-- C) Backfill record esistenti
UPDATE public.sinistri s
SET cliente_anagrafica_id = t.cliente_anagrafica_id
FROM public.titoli t
WHERE s.titolo_id = t.id
  AND s.cliente_anagrafica_id IS NULL
  AND t.cliente_anagrafica_id IS NOT NULL;

UPDATE public.sinistri s
SET compagnia_id = t.compagnia_id
FROM public.titoli t
WHERE s.titolo_id = t.id
  AND s.compagnia_id IS NULL
  AND t.compagnia_id IS NOT NULL;

UPDATE public.sinistri s
SET ufficio_id = t.ufficio_id
FROM public.titoli t
WHERE s.titolo_id = t.id
  AND s.ufficio_id IS NULL
  AND t.ufficio_id IS NOT NULL;

UPDATE public.sinistri s
SET ufficio_id = c.ufficio_id
FROM public.clienti c
WHERE s.cliente_anagrafica_id = c.id
  AND s.ufficio_id IS NULL
  AND c.ufficio_id IS NOT NULL;

-- D) Backfill checklist mancanti
INSERT INTO public.sinistro_checklist (sinistro_id, descrizione, obbligatorio)
SELECT s.id, x.descrizione, x.obbligatorio
FROM public.sinistri s
CROSS JOIN (VALUES
  ('Denuncia sinistro compilata', true),
  ('Documentazione fotografica', true),
  ('Copia polizza allegata', true),
  ('Modulo CID/CAI compilato', false)
) AS x(descrizione, obbligatorio)
WHERE NOT EXISTS (SELECT 1 FROM public.sinistro_checklist sc WHERE sc.sinistro_id = s.id);
