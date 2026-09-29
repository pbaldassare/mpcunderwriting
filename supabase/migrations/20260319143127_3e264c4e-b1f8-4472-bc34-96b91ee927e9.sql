
-- 1. Add cliente_anagrafica_id column to titoli
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS cliente_anagrafica_id UUID REFERENCES public.clienti(id);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_titoli_cliente_anagrafica_id ON public.titoli(cliente_anagrafica_id);

-- 3. Create clienti_relazioni table
CREATE TABLE IF NOT EXISTS public.clienti_relazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  cliente_collegato_id UUID NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  tipo_relazione TEXT NOT NULL DEFAULT 'referente',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT clienti_relazioni_unique UNIQUE (cliente_id, cliente_collegato_id)
);

-- 4. Validation trigger for tipo_relazione
CREATE OR REPLACE FUNCTION public.validate_clienti_relazioni_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo_relazione NOT IN ('dipendente', 'legale_rappresentante', 'referente', 'socio') THEN
    RAISE EXCEPTION 'Invalid tipo_relazione: %', NEW.tipo_relazione;
  END IF;
  IF NEW.cliente_id = NEW.cliente_collegato_id THEN
    RAISE EXCEPTION 'Cannot create self-relation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_clienti_relazioni
BEFORE INSERT OR UPDATE ON public.clienti_relazioni
FOR EACH ROW EXECUTE FUNCTION public.validate_clienti_relazioni_tipo();

-- 5. Enable RLS on clienti_relazioni
ALTER TABLE public.clienti_relazioni ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for clienti_relazioni
CREATE POLICY "Authenticated users can view clienti_relazioni"
ON public.clienti_relazioni FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clienti_relazioni"
ON public.clienti_relazioni FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clienti_relazioni"
ON public.clienti_relazioni FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clienti_relazioni"
ON public.clienti_relazioni FOR DELETE TO authenticated USING (true);
