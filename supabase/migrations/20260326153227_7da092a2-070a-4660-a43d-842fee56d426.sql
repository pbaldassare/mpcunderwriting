
-- Categorie template
CREATE TABLE public.template_categorie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descrizione text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.template_categorie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template_categorie"
  ON public.template_categorie FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage template_categorie"
  ON public.template_categorie FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','ufficio'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','ufficio'))
  );

-- Template email
CREATE TABLE public.template_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.template_categorie(id) ON DELETE CASCADE,
  nome text NOT NULL,
  oggetto text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.template_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template_email"
  ON public.template_email FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage template_email"
  ON public.template_email FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','ufficio'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('admin','ufficio'))
  );

-- Trigger updated_at
CREATE TRIGGER set_template_email_updated_at
  BEFORE UPDATE ON public.template_email
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed categorie
INSERT INTO public.template_categorie (nome, descrizione) VALUES
  ('Sollecito', 'Template per solleciti di pagamento'),
  ('Rinnovo', 'Template per avvisi di rinnovo polizza');

-- Seed template esempio
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id,
  'Sollecito pagamento polizza',
  'Sollecito pagamento polizza n. {{polizza_numero}}',
  E'Gentile {{cliente_nome}} {{cliente_cognome}},\n\nla informiamo che la polizza n. {{polizza_numero}} presso {{compagnia_nome}} risulta scaduta il {{polizza_scadenza}} con un premio di € {{polizza_premio}}.\n\nLa preghiamo di provvedere al pagamento al più presto.\n\nCordiali saluti,\n{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Sollecito';

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id,
  'Avviso rinnovo polizza',
  'Rinnovo polizza n. {{polizza_numero}} in scadenza',
  E'Gentile {{cliente_nome}} {{cliente_cognome}},\n\nle ricordiamo che la Sua polizza n. {{polizza_numero}} ({{compagnia_nome}}) è in scadenza il {{polizza_scadenza}}.\n\nIl premio per il rinnovo è di € {{polizza_premio}}.\n\nResta a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Rinnovo';
