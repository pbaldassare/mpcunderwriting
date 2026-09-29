
-- Tabella flussi_compagnia
CREATE TABLE public.flussi_compagnia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compagnia_id uuid REFERENCES public.compagnie(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  tipo_flusso text NOT NULL DEFAULT 'foglio_cassa',
  periodo text NOT NULL,
  formato text NOT NULL DEFAULT 'xml',
  payload_output text,
  stato text NOT NULL DEFAULT 'bozza',
  api_endpoint text,
  api_response text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_flussi_compagnia()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo_flusso NOT IN ('foglio_cassa','reportistica') THEN
    RAISE EXCEPTION 'Invalid tipo_flusso: %', NEW.tipo_flusso;
  END IF;
  IF NEW.formato NOT IN ('xml','api') THEN
    RAISE EXCEPTION 'Invalid formato: %', NEW.formato;
  END IF;
  IF NEW.stato NOT IN ('bozza','pronto','inviato','errore') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_flussi_compagnia
BEFORE INSERT OR UPDATE ON public.flussi_compagnia
FOR EACH ROW EXECUTE FUNCTION public.validate_flussi_compagnia();

-- RLS
ALTER TABLE public.flussi_compagnia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all flussi_compagnia" ON public.flussi_compagnia FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select flussi_compagnia" ON public.flussi_compagnia FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "CFO update flussi_compagnia" ON public.flussi_compagnia FOR UPDATE USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Ufficio select own flussi_compagnia" ON public.flussi_compagnia FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own flussi_compagnia" ON public.flussi_compagnia FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- Indici
CREATE INDEX idx_flussi_compagnia_compagnia ON public.flussi_compagnia(compagnia_id);
CREATE INDEX idx_flussi_compagnia_ufficio ON public.flussi_compagnia(ufficio_id);
CREATE INDEX idx_flussi_compagnia_stato ON public.flussi_compagnia(stato);
CREATE INDEX idx_flussi_compagnia_periodo ON public.flussi_compagnia(periodo);
