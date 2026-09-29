
-- 1) Backup 334 conti tipo='compagnia' (refusi legacy)
CREATE TABLE IF NOT EXISTS public._backup_conti_compagnia_20260516 AS
  SELECT * FROM public.conti_bancari WHERE tipo = 'compagnia';

ALTER TABLE public._backup_conti_compagnia_20260516 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Solo admin legge backup conti compagnia" ON public._backup_conti_compagnia_20260516;
CREATE POLICY "Solo admin legge backup conti compagnia"
  ON public._backup_conti_compagnia_20260516
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin'));

-- 2) Cancellazione refusi
DELETE FROM public.conti_bancari WHERE tipo = 'compagnia';

-- 3) Nuove colonne: link a compagnie (broker/agenzia/direzione/plurimandataria) + rapporto opzionale
ALTER TABLE public.conti_bancari
  ADD COLUMN IF NOT EXISTS compagnia_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rapporto_id  uuid REFERENCES public.compagnia_rapporti(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conti_bancari_compagnia ON public.conti_bancari(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_conti_bancari_rapporto  ON public.conti_bancari(rapporto_id);

-- 4) Aggiorna trigger normalize per nuovi tipi (drop 'compagnia', add 4 nuovi)
CREATE OR REPLACE FUNCTION public.normalize_conto_bancario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.iban IS NOT NULL THEN
    NEW.iban := UPPER(REGEXP_REPLACE(NEW.iban, '\s+', '', 'g'));
  END IF;

  IF NEW.iban LIKE 'IT%' AND LENGTH(NEW.iban) <> 27 THEN
    RAISE EXCEPTION 'IBAN italiano non valido: deve essere lungo 27 caratteri (ricevuto %).', LENGTH(NEW.iban);
  END IF;

  IF NEW.tipo NOT IN ('incasso_clienti','provvigioni','generico','agenzia','broker','direzione','plurimandataria') THEN
    RAISE EXCEPTION 'Tipo conto non valido: %', NEW.tipo;
  END IF;

  -- Coerenza: tipi entità richiedono compagnia_id
  IF NEW.tipo IN ('agenzia','broker','direzione','plurimandataria') AND NEW.compagnia_id IS NULL THEN
    RAISE EXCEPTION 'Per tipo % è obbligatorio compagnia_id (entità intestataria del conto).', NEW.tipo;
  END IF;

  -- rapporto_id solo per broker/plurimandataria
  IF NEW.rapporto_id IS NOT NULL THEN
    IF NEW.tipo NOT IN ('broker','plurimandataria') THEN
      RAISE EXCEPTION 'rapporto_id consentito solo per tipo broker o plurimandataria';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.compagnia_rapporti r
      WHERE r.id = NEW.rapporto_id AND r.compagnia_id = NEW.compagnia_id
    ) THEN
      RAISE EXCEPTION 'rapporto_id non appartiene alla compagnia indicata';
    END IF;
  END IF;

  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$function$;
