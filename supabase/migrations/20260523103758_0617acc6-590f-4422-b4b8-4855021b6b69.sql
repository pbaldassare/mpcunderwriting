-- Codice cliente 7 cifre univoco auto-generato
ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS codice_cliente TEXT;

CREATE SEQUENCE IF NOT EXISTS public.clienti_codice_seq START WITH 1000000 MINVALUE 1 NO CYCLE;

CREATE OR REPLACE FUNCTION public.generate_codice_cliente()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_code := LPAD(nextval('public.clienti_codice_seq')::text, 7, '0');
    IF NOT EXISTS (SELECT 1 FROM public.clienti WHERE codice_cliente = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Impossibile generare codice_cliente univoco';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_codice_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.codice_cliente IS NULL OR NEW.codice_cliente = '' THEN
    NEW.codice_cliente := public.generate_codice_cliente();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_codice_cliente ON public.clienti;
CREATE TRIGGER trg_set_codice_cliente
BEFORE INSERT ON public.clienti
FOR EACH ROW EXECUTE FUNCTION public.set_codice_cliente();

-- Backfill clienti esistenti
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.clienti WHERE codice_cliente IS NULL ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.clienti SET codice_cliente = public.generate_codice_cliente() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.clienti ADD CONSTRAINT clienti_codice_cliente_unique UNIQUE (codice_cliente);
CREATE INDEX IF NOT EXISTS idx_clienti_codice_cliente ON public.clienti(codice_cliente);