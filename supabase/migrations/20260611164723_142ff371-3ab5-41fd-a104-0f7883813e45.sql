
CREATE TABLE public.prodotti_cga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_prodotto text NOT NULL,
  compagnia text,
  ramo text,
  edizione text,
  sommario_ai text,
  testo_completo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome_prodotto, compagnia, edizione)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_cga TO authenticated;
GRANT ALL ON public.prodotti_cga TO service_role;
ALTER TABLE public.prodotti_cga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prodotti_cga_read_all_auth" ON public.prodotti_cga FOR SELECT TO authenticated USING (true);
CREATE POLICY "prodotti_cga_write_admin" ON public.prodotti_cga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prodotti_garanzie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  garanzia text NOT NULL,
  massimale_standard numeric(12,2),
  franchigia_standard numeric(12,2),
  scoperto_percentuale numeric(5,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prodotti_garanzie_prodotto_idx ON public.prodotti_garanzie(prodotto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_garanzie TO authenticated;
GRANT ALL ON public.prodotti_garanzie TO service_role;
ALTER TABLE public.prodotti_garanzie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prodotti_garanzie_read_all_auth" ON public.prodotti_garanzie FOR SELECT TO authenticated USING (true);
CREATE POLICY "prodotti_garanzie_write_admin" ON public.prodotti_garanzie FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prodotti_condizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('apertura_sinistro','esclusione','obbligo_assicurato','termine_denuncia','altro')),
  titolo text,
  testo text NOT NULL,
  rilevante_sinistri boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prodotti_condizioni_prodotto_idx ON public.prodotti_condizioni(prodotto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_condizioni TO authenticated;
GRANT ALL ON public.prodotti_condizioni TO service_role;
ALTER TABLE public.prodotti_condizioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prodotti_condizioni_read_all_auth" ON public.prodotti_condizioni FOR SELECT TO authenticated USING (true);
CREATE POLICY "prodotti_condizioni_write_admin" ON public.prodotti_condizioni FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.polizza_cga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE RESTRICT,
  documento_id uuid REFERENCES public.documenti(id) ON DELETE SET NULL,
  sommario_personalizzato text,
  stato text NOT NULL DEFAULT 'in_elaborazione'
    CHECK (stato IN ('in_elaborazione','bozza','approvato')),
  approvato_da uuid REFERENCES auth.users(id),
  approvato_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX polizza_cga_cliente_idx ON public.polizza_cga(cliente_id);
CREATE INDEX polizza_cga_titolo_idx ON public.polizza_cga(titolo_id);
CREATE INDEX polizza_cga_prodotto_idx ON public.polizza_cga(prodotto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_cga TO authenticated;
GRANT ALL ON public.polizza_cga TO service_role;
ALTER TABLE public.polizza_cga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polizza_cga_read_via_cliente" ON public.polizza_cga FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR EXISTS (
    SELECT 1 FROM public.clienti c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND (p.ufficio_id IS NULL OR c.ufficio_id = p.ufficio_id)
  )
);
CREATE POLICY "polizza_cga_write_via_cliente" ON public.polizza_cga FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR EXISTS (
    SELECT 1 FROM public.clienti c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id AND c.ufficio_id = p.ufficio_id
  )
) WITH CHECK (true);

CREATE TABLE public.polizza_garanzie_personali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  prodotto_garanzia_id uuid REFERENCES public.prodotti_garanzie(id) ON DELETE SET NULL,
  massimale_personalizzato numeric(12,2),
  franchigia_personalizzata numeric(12,2),
  scoperto_personalizzato numeric(5,2),
  note_personali text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX polizza_garanzie_personali_polizza_idx ON public.polizza_garanzie_personali(polizza_cga_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_garanzie_personali TO authenticated;
GRANT ALL ON public.polizza_garanzie_personali TO service_role;
ALTER TABLE public.polizza_garanzie_personali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polizza_garanzie_personali_read" ON public.polizza_garanzie_personali FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.polizza_cga pc WHERE pc.id = polizza_cga_id)
);
CREATE POLICY "polizza_garanzie_personali_write" ON public.polizza_garanzie_personali FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.polizza_cga pc WHERE pc.id = polizza_cga_id)
) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_cga_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_prodotti_cga_updated_at BEFORE UPDATE ON public.prodotti_cga
  FOR EACH ROW EXECUTE FUNCTION public.update_cga_updated_at();
CREATE TRIGGER trg_polizza_cga_updated_at BEFORE UPDATE ON public.polizza_cga
  FOR EACH ROW EXECUTE FUNCTION public.update_cga_updated_at();
