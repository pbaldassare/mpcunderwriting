
-- 1) Flag principale
ALTER TABLE public.compagnia_rapporti
  ADD COLUMN IF NOT EXISTS is_principale boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_compagnia_rapporto_principale
  ON public.compagnia_rapporti (compagnia_id)
  WHERE is_principale = true;

-- 2) Auto-create rapporto principale on INSERT compagnia (agenzia/direzione)
CREATE OR REPLACE FUNCTION public.tg_compagnie_auto_rapporto_principale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_rapporto text;
  v_gruppo uuid;
BEGIN
  IF NEW.tipo NOT IN ('agenzia','direzione') THEN
    RETURN NEW;
  END IF;
  IF NEW.gruppo_compagnia_id IS NULL THEN
    RETURN NEW; -- non possiamo creare senza gruppo (NOT NULL)
  END IF;

  v_tipo_rapporto := CASE NEW.tipo WHEN 'agenzia' THEN 'Agenzia' WHEN 'direzione' THEN 'Direzione' END;
  v_gruppo := NEW.gruppo_compagnia_id;

  INSERT INTO public.compagnia_rapporti (
    compagnia_id, gruppo_compagnia_id, tipo_rapporto, nome_rapporto, codice_rapporto,
    iban_dedicato, sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
    note, attivo, is_principale, conto_bancario_id
  )
  VALUES (
    NEW.id, v_gruppo, v_tipo_rapporto, NEW.nome, NEW.codice,
    NEW.iban, NEW.nome_sede, NEW.indirizzo, NEW.cap, NEW.comune, NEW.provincia,
    NEW.note, COALESCE(NEW.attiva, true), true, NEW.conto_bancario_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compagnie_auto_rapporto_principale ON public.compagnie;
CREATE TRIGGER trg_compagnie_auto_rapporto_principale
AFTER INSERT ON public.compagnie
FOR EACH ROW
EXECUTE FUNCTION public.tg_compagnie_auto_rapporto_principale();

-- 3) Sync: compagnia → rapporto principale
CREATE OR REPLACE FUNCTION public.tg_compagnie_sync_rapporto_principale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- evita loop infiniti con la controparte
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.tipo NOT IN ('agenzia','direzione') THEN RETURN NEW; END IF;

  UPDATE public.compagnia_rapporti SET
    nome_rapporto       = NEW.nome,
    codice_rapporto     = NEW.codice,
    iban_dedicato       = NEW.iban,
    sede_denominazione  = NEW.nome_sede,
    sede_indirizzo      = NEW.indirizzo,
    sede_cap            = NEW.cap,
    sede_citta          = NEW.comune,
    sede_provincia      = NEW.provincia,
    note                = NEW.note,
    attivo              = COALESCE(NEW.attiva, attivo),
    gruppo_compagnia_id = COALESCE(NEW.gruppo_compagnia_id, gruppo_compagnia_id),
    conto_bancario_id   = NEW.conto_bancario_id,
    updated_at          = now()
  WHERE compagnia_id = NEW.id AND is_principale = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compagnie_sync_rapporto_principale ON public.compagnie;
CREATE TRIGGER trg_compagnie_sync_rapporto_principale
AFTER UPDATE ON public.compagnie
FOR EACH ROW
WHEN (
  OLD.nome IS DISTINCT FROM NEW.nome OR
  OLD.codice IS DISTINCT FROM NEW.codice OR
  OLD.iban IS DISTINCT FROM NEW.iban OR
  OLD.nome_sede IS DISTINCT FROM NEW.nome_sede OR
  OLD.indirizzo IS DISTINCT FROM NEW.indirizzo OR
  OLD.cap IS DISTINCT FROM NEW.cap OR
  OLD.comune IS DISTINCT FROM NEW.comune OR
  OLD.provincia IS DISTINCT FROM NEW.provincia OR
  OLD.note IS DISTINCT FROM NEW.note OR
  OLD.attiva IS DISTINCT FROM NEW.attiva OR
  OLD.gruppo_compagnia_id IS DISTINCT FROM NEW.gruppo_compagnia_id OR
  OLD.conto_bancario_id IS DISTINCT FROM NEW.conto_bancario_id
)
EXECUTE FUNCTION public.tg_compagnie_sync_rapporto_principale();

-- 4) Sync inverso: rapporto principale → compagnia
CREATE OR REPLACE FUNCTION public.tg_rapporto_principale_sync_compagnia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.is_principale IS NOT TRUE THEN RETURN NEW; END IF;

  UPDATE public.compagnie SET
    nome              = COALESCE(NEW.nome_rapporto, nome),
    codice            = NEW.codice_rapporto,
    iban              = NEW.iban_dedicato,
    nome_sede         = NEW.sede_denominazione,
    indirizzo         = NEW.sede_indirizzo,
    cap               = NEW.sede_cap,
    comune            = NEW.sede_citta,
    provincia         = NEW.sede_provincia,
    note              = NEW.note,
    gruppo_compagnia_id = NEW.gruppo_compagnia_id,
    conto_bancario_id = NEW.conto_bancario_id
  WHERE id = NEW.compagnia_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rapporto_principale_sync_compagnia ON public.compagnia_rapporti;
CREATE TRIGGER trg_rapporto_principale_sync_compagnia
AFTER UPDATE ON public.compagnia_rapporti
FOR EACH ROW
WHEN (NEW.is_principale = true)
EXECUTE FUNCTION public.tg_rapporto_principale_sync_compagnia();

-- 5) Backfill one-shot: crea il rapporto principale per le Agenzie/Direzioni che non ce l'hanno
INSERT INTO public.compagnia_rapporti (
  compagnia_id, gruppo_compagnia_id, tipo_rapporto, nome_rapporto, codice_rapporto,
  iban_dedicato, sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
  note, attivo, is_principale, conto_bancario_id
)
SELECT
  c.id, c.gruppo_compagnia_id,
  CASE c.tipo WHEN 'agenzia' THEN 'Agenzia' WHEN 'direzione' THEN 'Direzione' END,
  c.nome, c.codice, c.iban, c.nome_sede, c.indirizzo, c.cap, c.comune, c.provincia,
  c.note, COALESCE(c.attiva, true), true, c.conto_bancario_id
FROM public.compagnie c
WHERE c.tipo IN ('agenzia','direzione')
  AND c.gruppo_compagnia_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.compagnia_rapporti r WHERE r.compagnia_id = c.id);

-- 6) Marca come principale eventuali rapporti già esistenti (uno per compagnia agenzia/direzione)
UPDATE public.compagnia_rapporti r
SET is_principale = true
FROM public.compagnie c
WHERE r.compagnia_id = c.id
  AND c.tipo IN ('agenzia','direzione')
  AND r.is_principale = false
  AND r.id = (
    SELECT id FROM public.compagnia_rapporti
    WHERE compagnia_id = c.id
    ORDER BY created_at ASC LIMIT 1
  );
