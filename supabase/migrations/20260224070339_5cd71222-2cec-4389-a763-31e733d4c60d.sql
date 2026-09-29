
-- Tabella rimessa_premi
CREATE TABLE public.rimessa_premi (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compagnia_id uuid REFERENCES public.compagnie(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  data_creazione timestamp with time zone DEFAULT now(),
  stato text NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza','pronta','inviata','errore')),
  totale_importi numeric DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  xml_output text,
  api_endpoint text,
  api_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.rimessa_premi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all rimessa" ON public.rimessa_premi FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select rimessa" ON public.rimessa_premi FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own rimessa" ON public.rimessa_premi FOR SELECT USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio insert own rimessa" ON public.rimessa_premi FOR INSERT WITH CHECK (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own rimessa" ON public.rimessa_premi FOR UPDATE USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());

-- Tabella rimessa_dettaglio
CREATE TABLE public.rimessa_dettaglio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rimessa_id uuid NOT NULL REFERENCES public.rimessa_premi(id) ON DELETE CASCADE,
  titolo_id uuid REFERENCES public.titoli(id),
  importo numeric
);
ALTER TABLE public.rimessa_dettaglio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all rimessa_dettaglio" ON public.rimessa_dettaglio FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select rimessa_dettaglio" ON public.rimessa_dettaglio FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own rimessa_dettaglio" ON public.rimessa_dettaglio FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND rimessa_id IN (SELECT id FROM public.rimessa_premi WHERE ufficio_id = get_my_ufficio_id()));
CREATE POLICY "Ufficio insert own rimessa_dettaglio" ON public.rimessa_dettaglio FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ufficio') AND rimessa_id IN (SELECT id FROM public.rimessa_premi WHERE ufficio_id = get_my_ufficio_id()));
