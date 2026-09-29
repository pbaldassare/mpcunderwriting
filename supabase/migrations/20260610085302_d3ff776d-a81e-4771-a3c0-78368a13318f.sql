
CREATE OR REPLACE FUNCTION public.anticipi_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.cliente_anticipi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clienti(id) ON DELETE RESTRICT,
  data_anticipo DATE NOT NULL DEFAULT CURRENT_DATE,
  conto_bancario_id UUID REFERENCES public.conti_bancari(id) ON DELETE SET NULL,
  importo NUMERIC(12,2) NOT NULL CHECK (importo > 0),
  importo_residuo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (importo_residuo >= 0),
  note TEXT,
  creato_da UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cliente_anticipi_cliente ON public.cliente_anticipi(cliente_id);
CREATE INDEX idx_cliente_anticipi_residuo ON public.cliente_anticipi(cliente_id) WHERE importo_residuo > 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_anticipi TO authenticated;
GRANT ALL ON public.cliente_anticipi TO service_role;
ALTER TABLE public.cliente_anticipi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gestisce anticipi" ON public.cliente_anticipi FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')));

CREATE POLICY "Cliente vede propri anticipi" ON public.cliente_anticipi FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clienti c WHERE c.id = cliente_anticipi.cliente_id AND c.user_id = auth.uid()));

CREATE TABLE public.cliente_anticipi_utilizzi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anticipo_id UUID NOT NULL REFERENCES public.cliente_anticipi(id) ON DELETE RESTRICT,
  titolo_id UUID NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  importo_utilizzato NUMERIC(12,2) NOT NULL CHECK (importo_utilizzato > 0),
  data_utilizzo DATE NOT NULL DEFAULT CURRENT_DATE,
  creato_da UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anticipi_utilizzi_anticipo ON public.cliente_anticipi_utilizzi(anticipo_id);
CREATE INDEX idx_anticipi_utilizzi_titolo ON public.cliente_anticipi_utilizzi(titolo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_anticipi_utilizzi TO authenticated;
GRANT ALL ON public.cliente_anticipi_utilizzi TO service_role;
ALTER TABLE public.cliente_anticipi_utilizzi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gestisce utilizzi anticipi" ON public.cliente_anticipi_utilizzi FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')));

CREATE POLICY "Cliente vede propri utilizzi" ON public.cliente_anticipi_utilizzi FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cliente_anticipi a JOIN public.clienti c ON c.id = a.cliente_id WHERE a.id = cliente_anticipi_utilizzi.anticipo_id AND c.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.anticipi_ricalcola_residuo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aid UUID; v_imp NUMERIC(12,2); v_us NUMERIC(12,2);
BEGIN
  v_aid := COALESCE(NEW.anticipo_id, OLD.anticipo_id);
  SELECT importo INTO v_imp FROM public.cliente_anticipi WHERE id = v_aid;
  IF v_imp IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(importo_utilizzato),0) INTO v_us FROM public.cliente_anticipi_utilizzi WHERE anticipo_id = v_aid;
  IF v_us > v_imp THEN RAISE EXCEPTION 'Utilizzo (%) eccede importo anticipo (%)', v_us, v_imp; END IF;
  UPDATE public.cliente_anticipi SET importo_residuo = v_imp - v_us, updated_at = now() WHERE id = v_aid;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_anticipi_utilizzi_residuo
AFTER INSERT OR UPDATE OR DELETE ON public.cliente_anticipi_utilizzi
FOR EACH ROW EXECUTE FUNCTION public.anticipi_ricalcola_residuo();

CREATE OR REPLACE FUNCTION public.anticipi_init_residuo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.importo_residuo IS NULL OR NEW.importo_residuo = 0 THEN NEW.importo_residuo := NEW.importo; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_anticipi_init_residuo
BEFORE INSERT ON public.cliente_anticipi
FOR EACH ROW EXECUTE FUNCTION public.anticipi_init_residuo();

CREATE TRIGGER trg_anticipi_updated_at
BEFORE UPDATE ON public.cliente_anticipi
FOR EACH ROW EXECUTE FUNCTION public.anticipi_set_updated_at();
