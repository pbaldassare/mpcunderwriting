
-- Tabella sinistri
CREATE TABLE public.sinistri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_sinistro text,
  titolo_id uuid REFERENCES titoli(id),
  cliente_id uuid REFERENCES profiles(id),
  compagnia_id uuid REFERENCES compagnie(id),
  responsabile_id uuid REFERENCES profiles(id),
  ufficio_id uuid REFERENCES uffici(id),
  stato text NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto','in_lavorazione','in_attesa_documenti','chiuso','respinto')),
  data_apertura date NOT NULL DEFAULT CURRENT_DATE,
  data_chiusura date,
  descrizione text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sinistri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all sinistri" ON public.sinistri FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select sinistri" ON public.sinistri FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own sinistri" ON public.sinistri FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own sinistri" ON public.sinistri FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own sinistri" ON public.sinistri FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Produttore select own sinistri" ON public.sinistri FOR SELECT USING (has_role(auth.uid(), 'produttore') AND titolo_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid()));
CREATE POLICY "Cliente select own sinistri" ON public.sinistri FOR SELECT USING (has_role(auth.uid(), 'cliente') AND cliente_id = auth.uid());

-- Tabella sinistro_checklist
CREATE TABLE public.sinistro_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES sinistri(id) ON DELETE CASCADE,
  descrizione text NOT NULL,
  completato boolean DEFAULT false,
  obbligatorio boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sinistro_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all checklist" ON public.sinistro_checklist FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select checklist" ON public.sinistro_checklist FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio all own checklist" ON public.sinistro_checklist FOR ALL USING (sinistro_id IN (SELECT id FROM sinistri WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Produttore select own checklist" ON public.sinistro_checklist FOR SELECT USING (sinistro_id IN (SELECT id FROM sinistri WHERE titolo_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid())));
CREATE POLICY "Cliente select own checklist" ON public.sinistro_checklist FOR SELECT USING (sinistro_id IN (SELECT id FROM sinistri WHERE cliente_id = auth.uid()));

-- Tabella sinistro_eventi
CREATE TABLE public.sinistro_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES sinistri(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  data_scadenza date NOT NULL,
  stato text NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo','completato','scaduto')),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sinistro_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all eventi" ON public.sinistro_eventi FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select eventi" ON public.sinistro_eventi FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio all own eventi" ON public.sinistro_eventi FOR ALL USING (sinistro_id IN (SELECT id FROM sinistri WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Produttore select own eventi" ON public.sinistro_eventi FOR SELECT USING (sinistro_id IN (SELECT id FROM sinistri WHERE titolo_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid())));
CREATE POLICY "Cliente select own eventi" ON public.sinistro_eventi FOR SELECT USING (sinistro_id IN (SELECT id FROM sinistri WHERE cliente_id = auth.uid()));
