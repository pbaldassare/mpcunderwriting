-- 1. veicoli_polizza (1:1 con titoli)
CREATE TABLE public.veicoli_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL UNIQUE REFERENCES public.titoli(id) ON DELETE CASCADE,
  settore text, tipo_veicolo text, uso text,
  marca text, modello text, versione text,
  targa text, telaio text, veicolo_descrizione text,
  data_immatricolazione date, anno_acquisto integer,
  provincia_circolazione text, classe_bm text,
  massimale_1 numeric(14,2) DEFAULT 0, massimale_2 numeric(14,2) DEFAULT 0, massimale_3 numeric(14,2) DEFAULT 0,
  peius boolean DEFAULT false, franchigia numeric(14,2) DEFAULT 0,
  temporanea boolean DEFAULT false, carico_scarico boolean DEFAULT false, competizione boolean DEFAULT false, rimorchio boolean DEFAULT false,
  cv integer DEFAULT 0, kw integer DEFAULT 0, cc integer DEFAULT 0, posti integer DEFAULT 0,
  peso_motrice integer DEFAULT 0, peso_rimorchio integer DEFAULT 0, peso_totale integer DEFAULT 0,
  tipologia_guida text, tipo_alimentazione text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_veicoli_polizza_titolo ON public.veicoli_polizza(titolo_id);
CREATE INDEX idx_veicoli_polizza_targa ON public.veicoli_polizza(targa);
ALTER TABLE public.veicoli_polizza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on veicoli_polizza" ON public.veicoli_polizza FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Ufficio access veicoli_polizza" ON public.veicoli_polizza FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id()));
CREATE POLICY "Backoffice select veicoli_polizza" ON public.veicoli_polizza FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'backoffice'));
CREATE TRIGGER set_veicoli_polizza_updated_at BEFORE UPDATE ON public.veicoli_polizza FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. premi_garanzia_polizza (1:N con titoli)
CREATE TABLE public.premi_garanzia_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  garanzia text NOT NULL,
  capitale numeric(14,2) DEFAULT 0, tasso numeric(8,4) DEFAULT 0,
  firma numeric(14,2) DEFAULT 0, rata numeric(14,2) DEFAULT 0, annuo numeric(14,2) DEFAULT 0,
  ordine integer DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_premi_garanzia_titolo ON public.premi_garanzia_polizza(titolo_id);
ALTER TABLE public.premi_garanzia_polizza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on premi_garanzia_polizza" ON public.premi_garanzia_polizza FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Ufficio access premi_garanzia_polizza" ON public.premi_garanzia_polizza FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id()));
CREATE POLICY "Backoffice select premi_garanzia_polizza" ON public.premi_garanzia_polizza FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'backoffice'));

-- 3. conducenti_polizza (1:1 con titoli)
CREATE TABLE public.conducenti_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL UNIQUE REFERENCES public.titoli(id) ON DELETE CASCADE,
  nome text, cognome text, indirizzo text, cap text, citta text, provincia text,
  data_nascita date, tipo_patente text, data_rilascio_patente date, note text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_conducenti_polizza_titolo ON public.conducenti_polizza(titolo_id);
ALTER TABLE public.conducenti_polizza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on conducenti_polizza" ON public.conducenti_polizza FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Ufficio access conducenti_polizza" ON public.conducenti_polizza FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id AND t.ufficio_id = public.get_my_ufficio_id()));
CREATE POLICY "Backoffice select conducenti_polizza" ON public.conducenti_polizza FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'backoffice'));
CREATE TRIGGER set_conducenti_polizza_updated_at BEFORE UPDATE ON public.conducenti_polizza FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();