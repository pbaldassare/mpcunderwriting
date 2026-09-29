-- 1) Backfill rapporto principale per agenzie/direzioni senza rapporto
INSERT INTO public.compagnia_rapporti (
  compagnia_id, gruppo_compagnia_id, tipo_rapporto, nome_rapporto, codice_rapporto,
  iban_dedicato, sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
  note, attivo, is_principale, conto_bancario_id
)
SELECT
  c.id, c.gruppo_compagnia_id,
  CASE c.tipo WHEN 'agenzia' THEN 'Agenzia' WHEN 'direzione' THEN 'Direzione' END,
  c.nome, c.codice,
  c.iban, c.nome_sede, c.indirizzo, c.cap, c.comune, c.provincia,
  c.note, COALESCE(c.attiva, true), true, c.conto_bancario_id
FROM public.compagnie c
WHERE c.tipo IN ('agenzia','direzione')
  AND c.gruppo_compagnia_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.compagnia_rapporti r WHERE r.compagnia_id = c.id);

-- 2) Hardening trigger auto-rapporto: ora solleva eccezione se gruppo NULL
CREATE OR REPLACE FUNCTION public.tg_compagnie_auto_rapporto_principale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_rapporto text;
BEGIN
  IF NEW.tipo NOT IN ('agenzia','direzione') THEN
    RETURN NEW;
  END IF;
  IF NEW.gruppo_compagnia_id IS NULL THEN
    RAISE EXCEPTION 'Per compagnie di tipo % è obbligatorio il gruppo_compagnia_id (Compagnia madre)', NEW.tipo;
  END IF;

  v_tipo_rapporto := CASE NEW.tipo WHEN 'agenzia' THEN 'Agenzia' WHEN 'direzione' THEN 'Direzione' END;

  INSERT INTO public.compagnia_rapporti (
    compagnia_id, gruppo_compagnia_id, tipo_rapporto, nome_rapporto, codice_rapporto,
    iban_dedicato, sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
    note, attivo, is_principale, conto_bancario_id
  )
  VALUES (
    NEW.id, NEW.gruppo_compagnia_id, v_tipo_rapporto, NEW.nome, NEW.codice,
    NEW.iban, NEW.nome_sede, NEW.indirizzo, NEW.cap, NEW.comune, NEW.provincia,
    NEW.note, COALESCE(NEW.attiva, true), true, NEW.conto_bancario_id
  );
  RETURN NEW;
END;
$function$;

-- 3) Vincolo BEFORE INSERT/UPDATE su compagnie: gruppo obbligatorio per agenzia/direzione
CREATE OR REPLACE FUNCTION public.tg_compagnie_require_gruppo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo IN ('agenzia','direzione') AND NEW.gruppo_compagnia_id IS NULL THEN
    RAISE EXCEPTION 'Per compagnie di tipo % è obbligatorio selezionare la Compagnia madre (gruppo_compagnia_id)', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_compagnie_require_gruppo ON public.compagnie;
CREATE TRIGGER trg_compagnie_require_gruppo
BEFORE INSERT OR UPDATE ON public.compagnie
FOR EACH ROW EXECUTE FUNCTION public.tg_compagnie_require_gruppo();