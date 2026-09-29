
-- Create clienti table
CREATE TABLE public.clienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cliente text NOT NULL DEFAULT 'privato',
  
  -- Campi comuni
  email text,
  telefono text,
  pec text,
  ufficio_id uuid REFERENCES public.uffici(id),
  attivo boolean DEFAULT true,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Campi Privato
  nome text,
  cognome text,
  codice_fiscale text,
  data_nascita date,
  luogo_nascita text,
  indirizzo_residenza text,
  cap_residenza text,
  citta_residenza text,
  provincia_residenza text,
  
  -- Campi Azienda
  ragione_sociale text,
  partita_iva text,
  codice_fiscale_azienda text,
  codice_sdi text,
  forma_giuridica text,
  indirizzo_sede text,
  cap_sede text,
  citta_sede text,
  provincia_sede text,
  referente_nome text,
  referente_cognome text,
  referente_telefono text,
  referente_email text
);

-- Enable RLS
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin all clienti" ON public.clienti FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select clienti" ON public.clienti FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Ufficio select own clienti" ON public.clienti FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own clienti" ON public.clienti FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own clienti" ON public.clienti FOR UPDATE USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Contabilita select clienti" ON public.clienti FOR SELECT USING (has_role(auth.uid(), 'contabilita'::app_role));
CREATE POLICY "Produttore select clienti" ON public.clienti FOR SELECT USING (has_role(auth.uid(), 'produttore'::app_role));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_clienti_tipo()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo_cliente NOT IN ('privato', 'azienda') THEN
    RAISE EXCEPTION 'Invalid tipo_cliente: %', NEW.tipo_cliente;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_clienti_tipo
  BEFORE INSERT OR UPDATE ON public.clienti
  FOR EACH ROW EXECUTE FUNCTION public.validate_clienti_tipo();

-- Updated_at trigger
CREATE TRIGGER trg_clienti_updated_at
  BEFORE UPDATE ON public.clienti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Search index
CREATE INDEX idx_clienti_tipo ON public.clienti(tipo_cliente);
CREATE INDEX idx_clienti_ufficio ON public.clienti(ufficio_id);
CREATE INDEX idx_clienti_cf ON public.clienti(codice_fiscale) WHERE codice_fiscale IS NOT NULL;
CREATE INDEX idx_clienti_piva ON public.clienti(partita_iva) WHERE partita_iva IS NOT NULL;
