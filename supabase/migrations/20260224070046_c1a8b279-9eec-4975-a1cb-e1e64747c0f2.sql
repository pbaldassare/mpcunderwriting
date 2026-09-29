
-- Tabella titoli
CREATE TABLE public.titoli (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_titolo text,
  cliente_id uuid REFERENCES public.profiles(id),
  prodotto_id uuid REFERENCES public.prodotti(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  produttore_id uuid REFERENCES public.profiles(id),
  premio_lordo numeric,
  importo_incassato numeric,
  data_incasso date,
  stato text NOT NULL DEFAULT 'creato' CHECK (stato IN ('creato','incassato','stornato','annullato')),
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.titoli ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all titoli" ON public.titoli FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select titoli" ON public.titoli FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own titoli" ON public.titoli FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Produttore select own titoli" ON public.titoli FOR SELECT USING (has_role(auth.uid(), 'produttore') AND produttore_id = auth.uid());
CREATE POLICY "Cliente select own titoli" ON public.titoli FOR SELECT USING (has_role(auth.uid(), 'cliente') AND cliente_id = auth.uid());

-- Tabella provvigioni_generate
CREATE TABLE public.provvigioni_generate (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  percentuale numeric,
  importo_provvigione numeric,
  calcolata_il timestamp with time zone DEFAULT now(),
  pagata boolean DEFAULT false
);
ALTER TABLE public.provvigioni_generate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all provvigioni" ON public.provvigioni_generate FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select provvigioni" ON public.provvigioni_generate FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own provvigioni" ON public.provvigioni_generate FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND titolo_id IN (SELECT id FROM public.titoli WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Produttore select own provvigioni" ON public.provvigioni_generate FOR SELECT
  USING (has_role(auth.uid(), 'produttore') AND user_id = auth.uid());
CREATE POLICY "Cliente select own provvigioni" ON public.provvigioni_generate FOR SELECT
  USING (has_role(auth.uid(), 'cliente') AND titolo_id IN (SELECT id FROM public.titoli WHERE cliente_id = auth.uid()));
