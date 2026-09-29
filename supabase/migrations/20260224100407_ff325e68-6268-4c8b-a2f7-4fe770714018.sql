
-- 1) Tabella iva_registri
CREATE TABLE public.iva_registri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid REFERENCES public.uffici(id),
  periodo text NOT NULL,
  imponibile numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  totale numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.iva_registri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all iva_registri" ON public.iva_registri FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select iva_registri" ON public.iva_registri FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Contabilita all iva_registri" ON public.iva_registri FOR ALL USING (has_role(auth.uid(), 'contabilita'::app_role));
CREATE POLICY "Ufficio select own iva_registri" ON public.iva_registri FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own iva_registri" ON public.iva_registri FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- 2) Campi IVA opzionali su movimenti_contabili
ALTER TABLE public.movimenti_contabili
  ADD COLUMN iva_aliquota numeric,
  ADD COLUMN iva_imponibile numeric,
  ADD COLUMN iva_importo numeric;

-- Index per periodo su iva_registri
CREATE INDEX idx_iva_registri_periodo ON public.iva_registri(periodo);
CREATE INDEX idx_iva_registri_ufficio ON public.iva_registri(ufficio_id);

-- Index per movimenti con IVA
CREATE INDEX idx_movimenti_iva ON public.movimenti_contabili(iva_importo) WHERE iva_importo IS NOT NULL;
