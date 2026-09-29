CREATE TABLE public.produttori_provvigioni_ramo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anagrafica_id UUID NOT NULL REFERENCES public.anagrafiche_professionali(id) ON DELETE CASCADE,
  ramo_codice TEXT NOT NULL REFERENCES public.rami(codice) ON DELETE CASCADE,
  percentuale_provvigione NUMERIC(6,3),
  percentuale_consulenza NUMERIC(6,3),
  percentuale_ra NUMERIC(6,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (anagrafica_id, ramo_codice)
);

CREATE INDEX idx_ppr_anagrafica ON public.produttori_provvigioni_ramo(anagrafica_id);
CREATE INDEX idx_ppr_ramo ON public.produttori_provvigioni_ramo(ramo_codice);

ALTER TABLE public.produttori_provvigioni_ramo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all ppr" ON public.produttori_provvigioni_ramo
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select ppr" ON public.produttori_provvigioni_ramo
  FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));
CREATE POLICY "Contabilita select ppr" ON public.produttori_provvigioni_ramo
  FOR SELECT USING (has_role(auth.uid(), 'contabilita'::app_role));
CREATE POLICY "Produttore select ppr" ON public.produttori_provvigioni_ramo
  FOR SELECT USING (has_role(auth.uid(), 'produttore'::app_role));
CREATE POLICY "Ufficio select ppr" ON public.produttori_provvigioni_ramo
  FOR SELECT USING (
    has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.anagrafiche_professionali ap
      WHERE ap.id = produttori_provvigioni_ramo.anagrafica_id
        AND (ap.ufficio_id = get_my_ufficio_id() OR ap.ufficio_id IS NULL)
    )
  );
CREATE POLICY "Ufficio insert ppr" ON public.produttori_provvigioni_ramo
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.anagrafiche_professionali ap
      WHERE ap.id = produttori_provvigioni_ramo.anagrafica_id
        AND (ap.ufficio_id = get_my_ufficio_id() OR ap.ufficio_id IS NULL)
    )
  );
CREATE POLICY "Ufficio update ppr" ON public.produttori_provvigioni_ramo
  FOR UPDATE USING (
    has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.anagrafiche_professionali ap
      WHERE ap.id = produttori_provvigioni_ramo.anagrafica_id
        AND ap.ufficio_id = get_my_ufficio_id()
    )
  );
CREATE POLICY "Ufficio delete ppr" ON public.produttori_provvigioni_ramo
  FOR DELETE USING (
    has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.anagrafiche_professionali ap
      WHERE ap.id = produttori_provvigioni_ramo.anagrafica_id
        AND ap.ufficio_id = get_my_ufficio_id()
    )
  );

CREATE TRIGGER trg_ppr_updated_at
BEFORE UPDATE ON public.produttori_provvigioni_ramo
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();