
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_clienti', 'documenti_clienti', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_sinistri', 'documenti_sinistri', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_titoli', 'documenti_titoli', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_generali', 'documenti_generali', false);

-- Storage policies for all buckets
CREATE POLICY "Admin all storage" ON storage.objects FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select storage" ON storage.objects FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated select own" ON storage.objects FOR SELECT USING (auth.uid() IS NOT NULL);

-- Tabella documenti
CREATE TABLE public.documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_file text NOT NULL,
  path_storage text NOT NULL,
  bucket_name text NOT NULL DEFAULT 'documenti_generali',
  entita_tipo text NOT NULL,
  entita_id uuid NOT NULL,
  caricato_da uuid REFERENCES profiles(id),
  visibile_al_cliente boolean DEFAULT false,
  categoria text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all documenti" ON public.documenti FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select documenti" ON public.documenti FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own documenti" ON public.documenti FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND (
    (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'prospect' AND entita_id IN (SELECT id FROM prospect WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'cliente' AND entita_id IN (SELECT id FROM profiles WHERE ufficio_id = get_my_ufficio_id()))
  ));
CREATE POLICY "Ufficio insert own documenti" ON public.documenti FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ufficio'));
CREATE POLICY "Produttore select own documenti" ON public.documenti FOR SELECT
  USING (has_role(auth.uid(), 'produttore') AND (
    (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid()))
    OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE titolo_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid())))
  ));
CREATE POLICY "Cliente select own documenti" ON public.documenti FOR SELECT
  USING (has_role(auth.uid(), 'cliente') AND visibile_al_cliente = true AND (
    (entita_tipo = 'cliente' AND entita_id = auth.uid())
    OR (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE cliente_id = auth.uid()))
    OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE cliente_id = auth.uid()))
  ));

-- Tabella chat_messaggi
CREATE TABLE public.chat_messaggi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entita_tipo text NOT NULL,
  entita_id uuid NOT NULL,
  mittente_id uuid NOT NULL REFERENCES profiles(id),
  messaggio text NOT NULL,
  letto boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_messaggi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all chat" ON public.chat_messaggi FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select chat" ON public.chat_messaggi FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Authenticated insert chat" ON public.chat_messaggi FOR INSERT WITH CHECK (auth.uid() = mittente_id);
CREATE POLICY "Ufficio select own chat" ON public.chat_messaggi FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND (
    (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'prospect' AND entita_id IN (SELECT id FROM prospect WHERE ufficio_id = get_my_ufficio_id()))
    OR (entita_tipo = 'cliente' AND entita_id IN (SELECT id FROM profiles WHERE ufficio_id = get_my_ufficio_id()))
  ));
CREATE POLICY "Produttore select own chat" ON public.chat_messaggi FOR SELECT
  USING (has_role(auth.uid(), 'produttore') AND (
    (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid()))
    OR mittente_id = auth.uid()
  ));
CREATE POLICY "Cliente select own chat" ON public.chat_messaggi FOR SELECT
  USING (has_role(auth.uid(), 'cliente') AND (
    (entita_tipo = 'cliente' AND entita_id = auth.uid())
    OR (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE cliente_id = auth.uid()))
    OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE cliente_id = auth.uid()))
  ));
