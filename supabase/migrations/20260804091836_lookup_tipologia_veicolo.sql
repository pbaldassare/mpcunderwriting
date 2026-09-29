-- Tipologie veicolo (lookup di sistema, gestibile da Tabelle Base)
CREATE TABLE IF NOT EXISTS public.lookup_tipologia_veicolo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lookup_tipologia_veicolo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lookup_tipologia_veicolo"
  ON public.lookup_tipologia_veicolo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert lookup_tipologia_veicolo"
  ON public.lookup_tipologia_veicolo FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update lookup_tipologia_veicolo"
  ON public.lookup_tipologia_veicolo FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete lookup_tipologia_veicolo"
  ON public.lookup_tipologia_veicolo FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.lookup_tipologia_veicolo (codice, descrizione) VALUES
  ('AUTOAMBULANZA', 'Autoambulanza'),
  ('AUTOARTICOLATO', 'Autoarticolo'),
  ('AUTOBUS', 'Autobus'),
  ('AUTOCARAVAN', 'Autocaravan'),
  ('AUTOCARRO', 'Autocarro'),
  ('AUTOFUNEBRE', 'Autofunebre'),
  ('AUTOSNODATO', 'Autosnodato'),
  ('AUTOTRENO', 'Autotreno'),
  ('AUTOVEICOLO', 'Autoveicolo'),
  ('AUTOVETTURA', 'Autovettura'),
  ('CARRELLO_APPENDICE', 'Carrello appendice'),
  ('CICLOMOTORE', 'Ciclomotore'),
  ('FILOVEICOLO', 'Filoveicolo'),
  ('GATTO_DELLE_NEVI', 'Gatto delle nevi'),
  ('MACCHINE_AGRICOLE', 'Macchine agricole'),
  ('MACCHINE_OPERATRICI', 'Macchine operatrici'),
  ('MONOPATTINO', 'Monopattino'),
  ('MOTOCARRO', 'Motocarro'),
  ('MOTOCICLO', 'Motociclo'),
  ('MOTOSLITTA', 'Motoslitta'),
  ('NATANTE', 'Natante'),
  ('QUADRICICLO', 'Quadriciclo'),
  ('RIMORCHIO', 'Rimorchio'),
  ('SEMIRIMORCHIO', 'Semirimorchio'),
  ('TARGA_PROVA', 'Targa prova'),
  ('TRATTORE_AGRICOLO', 'Trattore agricolo'),
  ('TRATTORE_STRADALE', 'Trattore stradale'),
  ('TRICICLO', 'Triciclo')
ON CONFLICT (codice) DO NOTHING;
