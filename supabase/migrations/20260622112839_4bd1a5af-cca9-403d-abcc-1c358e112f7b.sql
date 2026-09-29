
-- 1) Backfill titoli.compagnia_rapporto_id per agenzie/direzioni con rapporto principale
UPDATE titoli t
SET compagnia_rapporto_id = cr.id
FROM compagnie c
JOIN compagnia_rapporti cr
  ON cr.compagnia_id = c.id AND cr.is_principale = true
WHERE t.compagnia_id = c.id
  AND t.compagnia_rapporto_id IS NULL
  AND c.tipo IN ('agenzia','direzione');

-- 2) Trigger: popola compagnia_rapporto_id su nuovo titolo / cambio compagnia
CREATE OR REPLACE FUNCTION public.tg_titoli_set_rapporto_principale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_rapp uuid;
BEGIN
  IF NEW.compagnia_rapporto_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.compagnia_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_tipo FROM compagnie WHERE id = NEW.compagnia_id;
  IF v_tipo IS NULL OR v_tipo NOT IN ('agenzia','direzione') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_rapp
  FROM compagnia_rapporti
  WHERE compagnia_id = NEW.compagnia_id AND is_principale = true
  LIMIT 1;

  IF v_rapp IS NOT NULL THEN
    NEW.compagnia_rapporto_id := v_rapp;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_titoli_set_rapporto_principale ON public.titoli;
CREATE TRIGGER tg_titoli_set_rapporto_principale
BEFORE INSERT OR UPDATE OF compagnia_id ON public.titoli
FOR EACH ROW
EXECUTE FUNCTION public.tg_titoli_set_rapporto_principale();
