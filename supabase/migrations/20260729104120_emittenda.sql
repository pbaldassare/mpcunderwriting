-- Emittenda: flag su titoli + progressivo IA0001, IA0002, …

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS emittenda boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.titoli.emittenda IS
  'Polizza emittenda: numero temporaneo IA####; il N° polizza resta modificabile anche dopo messa a cassa.';

CREATE SEQUENCE IF NOT EXISTS public.titoli_emittenda_seq;

-- Seed sequence da eventuali numeri IA* già presenti
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(substring(numero_titolo from 3)::bigint), 0)
    INTO v_max
  FROM public.titoli
  WHERE numero_titolo ~ '^IA[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.titoli_emittenda_seq', v_max, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.format_numero_emittenda(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'IA' || CASE
    WHEN length(p_n::text) < 4 THEN lpad(p_n::text, 4, '0')
    ELSE p_n::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.next_numero_emittenda()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;
  v_n := nextval('public.titoli_emittenda_seq');
  RETURN public.format_numero_emittenda(v_n);
END;
$$;

GRANT USAGE, SELECT ON SEQUENCE public.titoli_emittenda_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.format_numero_emittenda(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_numero_emittenda() TO authenticated, service_role;

-- Quietanze/figli con stesso numero ereditano il flag emittenda
CREATE OR REPLACE FUNCTION public.titoli_inherit_emittenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.emittenda, false) IS DISTINCT FROM TRUE
     AND NEW.numero_titolo IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.titoli t
       WHERE t.numero_titolo = NEW.numero_titolo
         AND t.emittenda = true
       LIMIT 1
     )
  THEN
    NEW.emittenda := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_inherit_emittenda ON public.titoli;
CREATE TRIGGER trg_titoli_inherit_emittenda
  BEFORE INSERT ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.titoli_inherit_emittenda();

-- Storico cambi numero: aggiungi causale emittenda
ALTER TABLE public.titoli_numeri_storici
  DROP CONSTRAINT IF EXISTS titoli_numeri_storici_causale_check;

ALTER TABLE public.titoli_numeri_storici
  ADD CONSTRAINT titoli_numeri_storici_causale_check
  CHECK (causale IN ('sostituzione', 'sospensione', 'riattivazione', 'emittenda'));
