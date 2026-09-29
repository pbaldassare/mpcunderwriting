-- 1. Add alternative/fiscal address fields and gruppo_statistico to clienti
ALTER TABLE public.clienti 
  ADD COLUMN IF NOT EXISTS indirizzo_alternativo text,
  ADD COLUMN IF NOT EXISTS cap_alternativo text,
  ADD COLUMN IF NOT EXISTS citta_alternativa text,
  ADD COLUMN IF NOT EXISTS provincia_alternativa text,
  ADD COLUMN IF NOT EXISTS indirizzo_fiscale text,
  ADD COLUMN IF NOT EXISTS cap_fiscale text,
  ADD COLUMN IF NOT EXISTS citta_fiscale text,
  ADD COLUMN IF NOT EXISTS provincia_fiscale text,
  ADD COLUMN IF NOT EXISTS gruppo_statistico text;

-- 2. Create nominativi_cliente table
CREATE TABLE public.nominativi_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  nome text,
  cognome text,
  email text,
  telefono text,
  ruolo text,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.nominativi_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage nominativi"
  ON public.nominativi_cliente
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Fix validate_codici_commerciali_ruolo to accept actual role values used by the app
CREATE OR REPLACE FUNCTION public.validate_codici_commerciali_ruolo()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ruolo NOT IN ('account_executive','corrispondente_1','corrispondente_2','corrispondente_3','AE','Backoffice','Agente','Produttore Sede','Executive') THEN
    RAISE EXCEPTION 'Invalid ruolo: %', NEW.ruolo;
  END IF;
  RETURN NEW;
END;
$function$;