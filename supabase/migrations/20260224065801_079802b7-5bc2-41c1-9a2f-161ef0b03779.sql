
-- Tabella compagnie
CREATE TABLE public.compagnie (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  codice text,
  attiva boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.compagnie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all compagnie" ON public.compagnie FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select compagnie" ON public.compagnie FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select compagnie" ON public.compagnie FOR SELECT USING (has_role(auth.uid(), 'ufficio'));

-- Tabella categorie_prodotto
CREATE TABLE public.categorie_prodotto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descrizione text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.categorie_prodotto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all categorie" ON public.categorie_prodotto FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select categorie" ON public.categorie_prodotto FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select categorie" ON public.categorie_prodotto FOR SELECT USING (has_role(auth.uid(), 'ufficio'));

-- Tabella prodotti
CREATE TABLE public.prodotti (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_prodotto text NOT NULL,
  compagnia_id uuid REFERENCES public.compagnie(id),
  categoria_id uuid REFERENCES public.categorie_prodotto(id),
  codice_prodotto text,
  multititolo boolean DEFAULT false,
  attivo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.prodotti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all prodotti" ON public.prodotti FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select prodotti" ON public.prodotti FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select prodotti" ON public.prodotti FOR SELECT USING (has_role(auth.uid(), 'ufficio'));

-- Tabella matrice_provvigioni
CREATE TABLE public.matrice_provvigioni (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prodotto_id uuid NOT NULL REFERENCES public.prodotti(id) ON DELETE CASCADE,
  ruolo text,
  ufficio_id uuid REFERENCES public.uffici(id),
  user_id uuid REFERENCES public.profiles(id),
  percentuale_provvigione numeric NOT NULL,
  tipo_calcolo text NOT NULL DEFAULT 'percentuale' CHECK (tipo_calcolo IN ('percentuale', 'fisso')),
  attiva boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.matrice_provvigioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all matrice" ON public.matrice_provvigioni FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select matrice" ON public.matrice_provvigioni FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select matrice" ON public.matrice_provvigioni FOR SELECT USING (has_role(auth.uid(), 'ufficio'));
