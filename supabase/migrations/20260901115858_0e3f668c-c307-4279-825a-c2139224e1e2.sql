-- 1. Catalogo campi estraibili per ramo
CREATE TABLE public.elaborazioni_campi_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gruppo_ramo_id UUID REFERENCES public.gruppi_ramo(id) ON DELETE CASCADE,
  chiave TEXT NOT NULL,
  etichetta TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'text',
  descrizione_ai TEXT,
  ordine INTEGER NOT NULL DEFAULT 0,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX elaborazioni_campi_catalogo_uniq
  ON public.elaborazioni_campi_catalogo (COALESCE(gruppo_ramo_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaborazioni_campi_catalogo TO authenticated;
GRANT ALL ON public.elaborazioni_campi_catalogo TO service_role;
ALTER TABLE public.elaborazioni_campi_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campi_catalogo_select" ON public.elaborazioni_campi_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "campi_catalogo_manage" ON public.elaborazioni_campi_catalogo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'));

-- 2. Template elaborazioni
CREATE TABLE public.elaborazioni_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT,
  gruppo_ramo_id UUID REFERENCES public.gruppi_ramo(id) ON DELETE SET NULL,
  campi JSONB NOT NULL DEFAULT '[]'::jsonb,
  corpo TEXT NOT NULL DEFAULT '',
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  ufficio_id UUID REFERENCES public.uffici(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaborazioni_template TO authenticated;
GRANT ALL ON public.elaborazioni_template TO service_role;
ALTER TABLE public.elaborazioni_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elab_template_select" ON public.elaborazioni_template
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "elab_template_insert" ON public.elaborazioni_template
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "elab_template_update" ON public.elaborazioni_template
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ufficio'));
CREATE POLICY "elab_template_delete" ON public.elaborazioni_template
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. Storico elaborazioni
CREATE TABLE public.elaborazioni (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clienti(id) ON DELETE CASCADE,
  titolo_id UUID REFERENCES public.titoli(id) ON DELETE SET NULL,
  documento_id UUID REFERENCES public.documenti(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.elaborazioni_template(id) ON DELETE SET NULL,
  gruppo_ramo_id UUID REFERENCES public.gruppi_ramo(id) ON DELETE SET NULL,
  titolo TEXT,
  campi_estratti JSONB NOT NULL DEFAULT '{}'::jsonb,
  contenuto TEXT,
  stato TEXT NOT NULL DEFAULT 'bozza',
  created_by UUID,
  ufficio_id UUID REFERENCES public.uffici(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX elaborazioni_cliente_idx ON public.elaborazioni (cliente_id);
CREATE INDEX elaborazioni_created_idx ON public.elaborazioni (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaborazioni TO authenticated;
GRANT ALL ON public.elaborazioni TO service_role;
ALTER TABLE public.elaborazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elaborazioni_select" ON public.elaborazioni
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR (ufficio_id IS NOT NULL AND ufficio_id = public.get_my_ufficio_id())
  );
CREATE POLICY "elaborazioni_insert" ON public.elaborazioni
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "elaborazioni_update" ON public.elaborazioni
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "elaborazioni_delete" ON public.elaborazioni
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.elaborazioni_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_elab_campi_updated BEFORE UPDATE ON public.elaborazioni_campi_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.elaborazioni_set_updated_at();
CREATE TRIGGER trg_elab_template_updated BEFORE UPDATE ON public.elaborazioni_template
  FOR EACH ROW EXECUTE FUNCTION public.elaborazioni_set_updated_at();
CREATE TRIGGER trg_elaborazioni_updated BEFORE UPDATE ON public.elaborazioni
  FOR EACH ROW EXECUTE FUNCTION public.elaborazioni_set_updated_at();

-- 5. Seed campi comuni (validi per tutti i rami)
INSERT INTO public.elaborazioni_campi_catalogo (gruppo_ramo_id, chiave, etichetta, tipo, descrizione_ai, ordine) VALUES
  (NULL, 'numero_polizza', 'Numero polizza', 'text', 'Numero identificativo della polizza', 10),
  (NULL, 'compagnia', 'Compagnia', 'text', 'Denominazione della compagnia assicuratrice', 20),
  (NULL, 'prodotto', 'Prodotto', 'text', 'Nome commerciale del prodotto assicurativo', 30),
  (NULL, 'contraente', 'Contraente', 'text', 'Ragione sociale o nominativo del contraente', 40),
  (NULL, 'contraente_cf_piva', 'CF / P.IVA contraente', 'text', 'Codice fiscale o partita IVA del contraente', 50),
  (NULL, 'contraente_indirizzo', 'Indirizzo contraente', 'text', 'Indirizzo completo del contraente', 60),
  (NULL, 'assicurato', 'Assicurato', 'text', 'Soggetto assicurato se diverso dal contraente', 70),
  (NULL, 'data_effetto', 'Data effetto', 'date', 'Data di decorrenza della copertura (ISO yyyy-mm-dd)', 80),
  (NULL, 'data_scadenza', 'Data scadenza', 'date', 'Data di scadenza della copertura (ISO yyyy-mm-dd)', 90),
  (NULL, 'frazionamento', 'Frazionamento', 'text', 'Periodicità di pagamento del premio', 100),
  (NULL, 'tacito_rinnovo', 'Tacito rinnovo', 'boolean', 'True se la polizza si rinnova tacitamente', 110),
  (NULL, 'premio_lordo', 'Premio lordo', 'number', 'Premio lordo totale annuo in euro', 120),
  (NULL, 'premio_netto', 'Premio imponibile', 'number', 'Premio imponibile in euro', 130),
  (NULL, 'imposte', 'Imposte', 'number', 'Totale imposte in euro', 140),
  (NULL, 'massimale', 'Massimale', 'number', 'Massimale principale di polizza in euro', 150),
  (NULL, 'franchigia', 'Franchigia', 'number', 'Franchigia principale in euro', 160),
  (NULL, 'scoperto', 'Scoperto %', 'number', 'Scoperto percentuale', 170),
  (NULL, 'garanzie', 'Elenco garanzie', 'text', 'Elenco sintetico delle garanzie prestate', 180),
  (NULL, 'esclusioni', 'Esclusioni principali', 'text', 'Sintesi delle principali esclusioni', 190),
  (NULL, 'ambito_territoriale', 'Ambito territoriale', 'text', 'Estensione territoriale della copertura', 200),
  (NULL, 'intermediario', 'Intermediario', 'text', 'Intermediario indicato in polizza', 210),
  (NULL, 'note', 'Note / clausole particolari', 'text', 'Clausole speciali o note rilevanti', 220);

-- 6. Seed campi specifici per ramo
INSERT INTO public.elaborazioni_campi_catalogo (gruppo_ramo_id, chiave, etichetta, tipo, descrizione_ai, ordine)
SELECT g.id, v.chiave, v.etichetta, v.tipo, v.descrizione_ai, v.ordine
FROM (VALUES
  ('ZQ', 'targa', 'Targa', 'text', 'Targa del veicolo assicurato', 300),
  ('ZQ', 'marca_modello', 'Marca e modello', 'text', 'Marca e modello del veicolo', 310),
  ('ZQ', 'telaio', 'Telaio', 'text', 'Numero di telaio del veicolo', 320),
  ('ZQ', 'classe_bm', 'Classe Bonus/Malus', 'text', 'Classe di merito CU assegnata', 330),
  ('ZQ', 'massimale_rca', 'Massimale RCA', 'number', 'Massimale di responsabilità civile auto', 340),
  ('ZQ', 'garanzie_accessorie', 'Garanzie accessorie', 'text', 'Furto/incendio, kasko, cristalli, assistenza, tutela legale', 350),
  ('ZQ', 'uso_veicolo', 'Uso del veicolo', 'text', 'Uso dichiarato del veicolo', 360),
  ('ZL', 'ubicazione_rischio', 'Ubicazione del rischio', 'text', 'Indirizzo dei beni assicurati', 300),
  ('ZL', 'somma_assicurata_fabbricato', 'Somma assicurata fabbricato', 'number', 'Valore assicurato del fabbricato', 310),
  ('ZL', 'somma_assicurata_contenuto', 'Somma assicurata contenuto', 'number', 'Valore assicurato del contenuto', 320),
  ('ZL', 'somma_assicurata_merci', 'Somma assicurata merci', 'number', 'Valore assicurato delle merci', 330),
  ('ZL', 'forma_garanzia', 'Forma di garanzia', 'text', 'Valore a nuovo, primo rischio assoluto/relativo', 340),
  ('ZL', 'eventi_atmosferici', 'Eventi atmosferici', 'text', 'Limiti e franchigie per eventi atmosferici', 350),
  ('ZL', 'furto_limiti', 'Limiti garanzia furto', 'text', 'Limiti, mezzi di chiusura e franchigie furto', 360),
  ('ZP', 'massimale_rct', 'Massimale RCT', 'number', 'Massimale per sinistro RCT', 300),
  ('ZP', 'massimale_rco', 'Massimale RCO', 'number', 'Massimale per sinistro RCO', 310),
  ('ZP', 'attivita_assicurata', 'Attività assicurata', 'text', 'Descrizione dell''attività svolta e assicurata', 320),
  ('ZP', 'fatturato_dichiarato', 'Fatturato dichiarato', 'number', 'Fatturato o retribuzioni dichiarate a preventivo', 330),
  ('ZP', 'regolazione_premio', 'Regolazione premio', 'text', 'Parametri e periodicità della regolazione premio', 340),
  ('ZN', 'somma_caso_morte', 'Somma caso morte', 'number', 'Capitale assicurato caso morte', 300),
  ('ZN', 'somma_invalidita_permanente', 'Somma invalidità permanente', 'number', 'Capitale assicurato invalidità permanente', 310),
  ('ZN', 'diaria_ricovero', 'Diaria da ricovero', 'number', 'Indennità giornaliera da ricovero', 320),
  ('ZN', 'categorie_assicurate', 'Categorie assicurate', 'text', 'Categorie di persone assicurate', 330),
  ('ZM', 'prestazioni_garantite', 'Prestazioni garantite', 'text', 'Elenco delle prestazioni sanitarie garantite', 300),
  ('ZM', 'massimale_annuo', 'Massimale annuo', 'number', 'Massimale annuo per nucleo/assicurato', 310),
  ('ZM', 'carenze', 'Periodi di carenza', 'text', 'Periodi di carenza previsti', 320),
  ('ZM', 'nucleo_assicurato', 'Nucleo assicurato', 'text', 'Composizione del nucleo assicurato', 330),
  ('ZS', 'massimale_spese_legali', 'Massimale spese legali', 'number', 'Massimale per spese legali e peritali', 300),
  ('ZS', 'ambito_tutela', 'Ambito di tutela', 'text', 'Materie e casi assicurati dalla tutela giudiziaria', 310)
) AS v(codice_ramo, chiave, etichetta, tipo, descrizione_ai, ordine)
JOIN public.gruppi_ramo g ON g.codice = v.codice_ramo;