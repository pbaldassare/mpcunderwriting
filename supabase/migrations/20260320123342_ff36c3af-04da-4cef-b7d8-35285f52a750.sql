-- =============================================
-- MODULO CONTABILITÀ GENERALE — 6 nuove tabelle
-- =============================================

-- 1. CAUSALI CONTABILI (tabelle di servizio)
CREATE TABLE public.causali_contabili (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_tabella text NOT NULL,
  codice text NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tipo_tabella, codice)
);

ALTER TABLE public.causali_contabili ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access causali" ON public.causali_contabili FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read causali" ON public.causali_contabili FOR SELECT TO authenticated USING (true);

-- Seed causali iniziali
INSERT INTO public.causali_contabili (tipo_tabella, codice, descrizione) VALUES
  ('causale_primanota', 'TBDSCC', 'Causali Primanota'),
  ('assoggettamento_iva', 'TBDSIV', 'Tabella assoggettamento IVA'),
  ('formato', 'TBDSFI', 'Tabella formato'),
  ('divisione', 'TBDSDV', 'Tabella divisioni'),
  ('modalita_consegna', 'TBDSCO', 'Tabella modalità di consegna'),
  ('tipo_compenso', 'TBDSCM', 'Tabella tipo compenso'),
  ('categoria_fido', 'TBDSCF', 'Tabella categoria fido'),
  ('codice_descrizione', 'TBDSCD', 'Tabella codice descrizione'),
  ('budget_report', 'TBDSRE', 'Budget Report');

-- 2. PRIMANOTA GENERALE
CREATE TABLE public.primanota_generale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pn text,
  data_pn date DEFAULT CURRENT_DATE,
  numero_protocollo text,
  data_protocollo date,
  numero_documento text,
  data_documento date,
  fornitore_id uuid REFERENCES public.fornitori(id),
  causale_id uuid REFERENCES public.causali_contabili(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  tipo text DEFAULT 'EE',
  descrizione text,
  totale numeric(12,2) DEFAULT 0,
  imponibile numeric(12,2) DEFAULT 0,
  aliquota_ritenuta numeric(5,2) DEFAULT 0,
  ritenuta numeric(12,2) DEFAULT 0,
  non_soggetto numeric(12,2) DEFAULT 0,
  altri_importi numeric(12,2) DEFAULT 0,
  stato text DEFAULT 'bozza',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.primanota_generale ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full primanota_gen" ON public.primanota_generale FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO read primanota_gen" ON public.primanota_generale FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita')));
CREATE POLICY "Ufficio own primanota_gen" ON public.primanota_generale FOR ALL TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id()) WITH CHECK (ufficio_id = public.get_my_ufficio_id());

-- 3. SCADENZIARIO
CREATE TABLE public.scadenziario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornitore_id uuid REFERENCES public.fornitori(id),
  primanota_id uuid REFERENCES public.primanota_generale(id),
  descrizione text,
  importo numeric(12,2) DEFAULT 0,
  data_scadenza date NOT NULL,
  data_pagamento date,
  stato text DEFAULT 'aperta',
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scadenziario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full scadenziario" ON public.scadenziario FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO read scadenziario" ON public.scadenziario FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita')));
CREATE POLICY "Ufficio own scadenziario" ON public.scadenziario FOR ALL TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id()) WITH CHECK (ufficio_id = public.get_my_ufficio_id());

-- 4. ELABORAZIONI PERIODICHE
CREATE TABLE public.elaborazioni_periodiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  periodo_da date,
  periodo_a date,
  ufficio_id uuid REFERENCES public.uffici(id),
  stato text DEFAULT 'da_elaborare',
  risultato_json jsonb,
  created_at timestamptz DEFAULT now(),
  eseguita_da uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.elaborazioni_periodiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full elab_period" ON public.elaborazioni_periodiche FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO read elab_period" ON public.elaborazioni_periodiche FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita')));
CREATE POLICY "Ufficio own elab_period" ON public.elaborazioni_periodiche FOR ALL TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id()) WITH CHECK (ufficio_id = public.get_my_ufficio_id());

-- 5. CERTIFICAZIONI CU
CREATE TABLE public.certificazioni_cu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anno_fiscale integer NOT NULL,
  fornitore_id uuid REFERENCES public.fornitori(id),
  codice_fornitore text,
  nome_fornitore text,
  numero_primanota text,
  data_primanota date,
  numero_protocollo text,
  numero_documento text,
  tipo_reddito text DEFAULT 'EE',
  totale numeric(12,2) DEFAULT 0,
  imponibile numeric(12,2) DEFAULT 0,
  aliquota_ritenuta numeric(5,2) DEFAULT 0,
  ritenuta numeric(12,2) DEFAULT 0,
  non_soggetto numeric(12,2) DEFAULT 0,
  altri_importi numeric(12,2) DEFAULT 0,
  stato text DEFAULT 'bozza',
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.certificazioni_cu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full cert_cu" ON public.certificazioni_cu FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO read cert_cu" ON public.certificazioni_cu FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita')));
CREATE POLICY "Ufficio own cert_cu" ON public.certificazioni_cu FOR ALL TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id()) WITH CHECK (ufficio_id = public.get_my_ufficio_id());

-- 6. ELABORAZIONI ANNUALI
CREATE TABLE public.elab_annuali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  anno integer NOT NULL,
  stato text DEFAULT 'da_elaborare',
  risultato_json jsonb,
  ufficio_id uuid REFERENCES public.uffici(id),
  created_at timestamptz DEFAULT now(),
  eseguita_da uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.elab_annuali ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full elab_annuali" ON public.elab_annuali FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO read elab_annuali" ON public.elab_annuali FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cfo','contabilita')));
CREATE POLICY "Ufficio own elab_annuali" ON public.elab_annuali FOR ALL TO authenticated
  USING (ufficio_id = public.get_my_ufficio_id()) WITH CHECK (ufficio_id = public.get_my_ufficio_id());