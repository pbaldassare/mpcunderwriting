
-- Tabella portafoglio_incassi
CREATE TABLE public.portafoglio_incassi (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ufficio_id uuid REFERENCES public.uffici(id),
  cliente_id uuid REFERENCES public.profiles(id),
  descrizione text NOT NULL,
  importo_atteso numeric NOT NULL DEFAULT 0,
  periodicita text NOT NULL DEFAULT 'annuale',
  prossima_scadenza date NOT NULL,
  stato text NOT NULL DEFAULT 'attivo',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for portafoglio_incassi
CREATE OR REPLACE FUNCTION public.validate_portafoglio_incassi()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.periodicita NOT IN ('mensile','trimestrale','annuale','una_tantum') THEN
    RAISE EXCEPTION 'Invalid periodicita: %', NEW.periodicita;
  END IF;
  IF NEW.stato NOT IN ('attivo','sospeso','chiuso') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_portafoglio_incassi
BEFORE INSERT OR UPDATE ON public.portafoglio_incassi
FOR EACH ROW EXECUTE FUNCTION public.validate_portafoglio_incassi();

-- RLS
ALTER TABLE public.portafoglio_incassi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all portafoglio_incassi" ON public.portafoglio_incassi FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select portafoglio_incassi" ON public.portafoglio_incassi FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Contabilita all portafoglio_incassi" ON public.portafoglio_incassi FOR ALL USING (has_role(auth.uid(), 'contabilita'::app_role));
CREATE POLICY "Ufficio select own portafoglio_incassi" ON public.portafoglio_incassi FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own portafoglio_incassi" ON public.portafoglio_incassi FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own portafoglio_incassi" ON public.portafoglio_incassi FOR UPDATE USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- Indici
CREATE INDEX idx_portafoglio_incassi_ufficio ON public.portafoglio_incassi(ufficio_id);
CREATE INDEX idx_portafoglio_incassi_stato ON public.portafoglio_incassi(stato);
CREATE INDEX idx_portafoglio_incassi_scadenza ON public.portafoglio_incassi(prossima_scadenza);

-- Tabella portafoglio_incassi_eventi
CREATE TABLE public.portafoglio_incassi_eventi (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portafoglio_id uuid NOT NULL REFERENCES public.portafoglio_incassi(id) ON DELETE CASCADE,
  data_scadenza date NOT NULL,
  importo_atteso numeric NOT NULL DEFAULT 0,
  esito text NOT NULL DEFAULT 'atteso',
  estratto_id uuid REFERENCES public.estratti_conto(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for eventi
CREATE OR REPLACE FUNCTION public.validate_portafoglio_eventi()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.esito NOT IN ('atteso','incassato','ko') THEN
    RAISE EXCEPTION 'Invalid esito: %', NEW.esito;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_portafoglio_eventi
BEFORE INSERT OR UPDATE ON public.portafoglio_incassi_eventi
FOR EACH ROW EXECUTE FUNCTION public.validate_portafoglio_eventi();

-- RLS
ALTER TABLE public.portafoglio_incassi_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Contabilita all portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR ALL USING (has_role(auth.uid(), 'contabilita'::app_role));
CREATE POLICY "Ufficio select own portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND portafoglio_id IN (SELECT id FROM portafoglio_incassi WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Ufficio insert own portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND portafoglio_id IN (SELECT id FROM portafoglio_incassi WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Ufficio update own portafoglio_eventi" ON public.portafoglio_incassi_eventi FOR UPDATE USING (has_role(auth.uid(), 'ufficio'::app_role) AND portafoglio_id IN (SELECT id FROM portafoglio_incassi WHERE ufficio_id = get_my_ufficio_id()));

-- Indici
CREATE INDEX idx_portafoglio_eventi_portafoglio ON public.portafoglio_incassi_eventi(portafoglio_id);
CREATE INDEX idx_portafoglio_eventi_esito ON public.portafoglio_incassi_eventi(esito);
CREATE INDEX idx_portafoglio_eventi_scadenza ON public.portafoglio_incassi_eventi(data_scadenza);
