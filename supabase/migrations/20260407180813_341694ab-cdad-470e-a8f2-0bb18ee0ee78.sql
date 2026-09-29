
-- 1. Tabella bandi_pubblici
CREATE TABLE public.bandi_pubblici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheda_id text UNIQUE NOT NULL,
  titolo text,
  oggetto text,
  ente text,
  tipologia text,
  importo numeric,
  scadenza date,
  cig text,
  link text,
  localita text,
  regione text,
  stato text NOT NULL DEFAULT 'aperto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabella ponte bandi_trattative
CREATE TABLE public.bandi_trattative (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bando_id uuid NOT NULL REFERENCES public.bandi_pubblici(id) ON DELETE CASCADE,
  trattativa_id uuid NOT NULL REFERENCES public.trattative(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bando_id, trattativa_id)
);

-- 3. Tabella ricerche_bandi
CREATE TABLE public.ricerche_bandi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regioni text[],
  risultati_count int DEFAULT 0,
  eseguita_da uuid REFERENCES public.profiles(id),
  eseguita_il timestamptz NOT NULL DEFAULT now()
);

-- RLS bandi_pubblici
ALTER TABLE public.bandi_pubblici ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bandi"
  ON public.bandi_pubblici FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bandi"
  ON public.bandi_pubblici FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bandi"
  ON public.bandi_pubblici FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS bandi_trattative
ALTER TABLE public.bandi_trattative ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bandi_trattative"
  ON public.bandi_trattative FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bandi_trattative"
  ON public.bandi_trattative FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bandi_trattative"
  ON public.bandi_trattative FOR DELETE
  TO authenticated
  USING (true);

-- RLS ricerche_bandi
ALTER TABLE public.ricerche_bandi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ricerche_bandi"
  ON public.ricerche_bandi FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ricerche_bandi"
  ON public.ricerche_bandi FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger updated_at per bandi_pubblici
CREATE TRIGGER set_bandi_pubblici_updated_at
  BEFORE UPDATE ON public.bandi_pubblici
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation trigger per stato bandi
CREATE OR REPLACE FUNCTION public.validate_bandi_stato()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stato NOT IN ('aperto', 'scaduto', 'in_valutazione') THEN
    RAISE EXCEPTION 'Invalid stato bando: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_bandi_pubblici_stato
  BEFORE INSERT OR UPDATE ON public.bandi_pubblici
  FOR EACH ROW EXECUTE FUNCTION public.validate_bandi_stato();
