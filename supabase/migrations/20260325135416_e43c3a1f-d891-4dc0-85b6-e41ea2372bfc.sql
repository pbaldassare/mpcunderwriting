-- 1. Add new columns to clienti
ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS codice_ricerca text,
  ADD COLUMN IF NOT EXISTS titolo text,
  ADD COLUMN IF NOT EXISTS stato_cliente text DEFAULT 'attivo',
  ADD COLUMN IF NOT EXISTS prospect text DEFAULT 'na',
  ADD COLUMN IF NOT EXISTS cellulare text,
  ADD COLUMN IF NOT EXISTS fax text,
  ADD COLUMN IF NOT EXISTS nazione text,
  ADD COLUMN IF NOT EXISTS attenzione_di text,
  ADD COLUMN IF NOT EXISTS tipo_persona text DEFAULT 'na',
  ADD COLUMN IF NOT EXISTS sesso text DEFAULT 'na',
  ADD COLUMN IF NOT EXISTS comune_nascita text,
  ADD COLUMN IF NOT EXISTS provincia_nascita text,
  ADD COLUMN IF NOT EXISTS tipo_sommario text,
  ADD COLUMN IF NOT EXISTS cliente_non_ceduto boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS azienda_ssn_sx boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS spec_sx_danni text,
  ADD COLUMN IF NOT EXISTS spec_sx_sanita text,
  ADD COLUMN IF NOT EXISTS statistica_premi_sinistri boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS zona text,
  ADD COLUMN IF NOT EXISTS indotto text,
  ADD COLUMN IF NOT EXISTS gruppo_finanziario_id uuid,
  ADD COLUMN IF NOT EXISTS attivita text,
  ADD COLUMN IF NOT EXISTS settore text,
  ADD COLUMN IF NOT EXISTS azienda_stat text,
  ADD COLUMN IF NOT EXISTS contratto text,
  ADD COLUMN IF NOT EXISTS matricola text,
  ADD COLUMN IF NOT EXISTS riferimento text,
  ADD COLUMN IF NOT EXISTS fatturato numeric,
  ADD COLUMN IF NOT EXISTS num_dipendenti integer,
  ADD COLUMN IF NOT EXISTS codice_ateco text,
  ADD COLUMN IF NOT EXISTS cliente_associato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_captive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS internazionale boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fido_credito numeric,
  ADD COLUMN IF NOT EXISTS fido_cauzioni numeric;

-- 2. Create gruppi_finanziari lookup table
CREATE TABLE IF NOT EXISTS public.gruppi_finanziari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gruppi_finanziari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read gruppi_finanziari"
  ON public.gruppi_finanziari FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage gruppi_finanziari"
  ON public.gruppi_finanziari FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FK from clienti to gruppi_finanziari
ALTER TABLE public.clienti
  ADD CONSTRAINT clienti_gruppo_finanziario_id_fkey
  FOREIGN KEY (gruppo_finanziario_id) REFERENCES public.gruppi_finanziari(id);

-- 3. Create codici_commerciali_cliente table
CREATE TABLE IF NOT EXISTS public.codici_commerciali_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  ruolo text NOT NULL,
  profilo_id uuid REFERENCES public.profiles(id),
  percentuale numeric(5,2) DEFAULT 0,
  societa_brand text,
  filiale text,
  mandato text,
  contatto text,
  data_acquisito date,
  scadenza_mandato date,
  data_disdetta date,
  termine_proroga date,
  altro_broker boolean DEFAULT false,
  altro_broker_nome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cliente_id, ruolo)
);

-- Validation trigger for ruolo
CREATE OR REPLACE FUNCTION public.validate_codici_commerciali_ruolo()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ruolo NOT IN ('account_executive','corrispondente_1','corrispondente_2','corrispondente_3') THEN
    RAISE EXCEPTION 'Invalid ruolo: %', NEW.ruolo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_codici_commerciali_ruolo_trigger
  BEFORE INSERT OR UPDATE ON public.codici_commerciali_cliente
  FOR EACH ROW EXECUTE FUNCTION public.validate_codici_commerciali_ruolo();

ALTER TABLE public.codici_commerciali_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read codici_commerciali"
  ON public.codici_commerciali_cliente FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/ufficio can manage codici_commerciali"
  ON public.codici_commerciali_cliente FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'));

-- Trigger for updated_at
CREATE TRIGGER set_codici_commerciali_updated_at
  BEFORE UPDATE ON public.codici_commerciali_cliente
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();