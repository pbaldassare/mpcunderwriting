
-- Tabella movimenti_contabili
CREATE TABLE public.movimenti_contabili (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ufficio_id uuid REFERENCES public.uffici(id),
  tipo text NOT NULL CHECK (tipo IN ('entrata','uscita')),
  categoria text,
  riferimento_tipo text,
  riferimento_id uuid,
  importo numeric NOT NULL,
  data_movimento date NOT NULL DEFAULT CURRENT_DATE,
  descrizione text,
  stato text NOT NULL DEFAULT 'registrato' CHECK (stato IN ('registrato','verificato')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.movimenti_contabili ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all movimenti" ON public.movimenti_contabili FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select movimenti" ON public.movimenti_contabili FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own movimenti" ON public.movimenti_contabili FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own movimenti" ON public.movimenti_contabili FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own movimenti" ON public.movimenti_contabili FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());

-- Tabella estratti_conto
CREATE TABLE public.estratti_conto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ufficio_id uuid REFERENCES public.uffici(id),
  data_operazione date NOT NULL DEFAULT CURRENT_DATE,
  descrizione text,
  importo numeric NOT NULL,
  saldo numeric,
  stato text NOT NULL DEFAULT 'da_verificare' CHECK (stato IN ('da_verificare','ok','ko')),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.estratti_conto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all estratti" ON public.estratti_conto FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select estratti" ON public.estratti_conto FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own estratti" ON public.estratti_conto FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own estratti" ON public.estratti_conto FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own estratti" ON public.estratti_conto FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());

-- Tabella incroci_bancari
CREATE TABLE public.incroci_bancari (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movimento_id uuid REFERENCES public.movimenti_contabili(id),
  estratto_id uuid REFERENCES public.estratti_conto(id),
  esito text NOT NULL CHECK (esito IN ('ok','ko')),
  differenza numeric DEFAULT 0,
  note text,
  verificato boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.incroci_bancari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all incroci" ON public.incroci_bancari FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select incroci" ON public.incroci_bancari FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own incroci" ON public.incroci_bancari FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND (
    movimento_id IN (SELECT id FROM public.movimenti_contabili WHERE ufficio_id = get_my_ufficio_id())
    OR estratto_id IN (SELECT id FROM public.estratti_conto WHERE ufficio_id = get_my_ufficio_id())
  ));
CREATE POLICY "Ufficio insert own incroci" ON public.incroci_bancari FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ufficio') AND (
    movimento_id IN (SELECT id FROM public.movimenti_contabili WHERE ufficio_id = get_my_ufficio_id())
    OR estratto_id IN (SELECT id FROM public.estratti_conto WHERE ufficio_id = get_my_ufficio_id())
  ));
CREATE POLICY "Ufficio update own incroci" ON public.incroci_bancari FOR UPDATE
  USING (has_role(auth.uid(), 'ufficio') AND (
    movimento_id IN (SELECT id FROM public.movimenti_contabili WHERE ufficio_id = get_my_ufficio_id())
    OR estratto_id IN (SELECT id FROM public.estratti_conto WHERE ufficio_id = get_my_ufficio_id())
  ));
