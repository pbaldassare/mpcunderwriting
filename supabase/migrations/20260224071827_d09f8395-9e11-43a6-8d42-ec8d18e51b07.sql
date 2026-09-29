
-- Tabella informative privacy
CREATE TABLE public.privacy_informative (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  versione text NOT NULL,
  contenuto text,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.privacy_informative ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all informative" ON public.privacy_informative FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select informative" ON public.privacy_informative FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select informative" ON public.privacy_informative FOR SELECT USING (has_role(auth.uid(), 'ufficio'));
CREATE POLICY "Produttore select informative" ON public.privacy_informative FOR SELECT USING (has_role(auth.uid(), 'produttore'));
CREATE POLICY "Cliente select active informative" ON public.privacy_informative FOR SELECT USING (has_role(auth.uid(), 'cliente') AND attiva = true);

-- Tabella consensi cliente
CREATE TABLE public.privacy_consensi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES profiles(id),
  informativa_id uuid REFERENCES privacy_informative(id),
  tipo_consenso text NOT NULL CHECK (tipo_consenso IN ('obbligatorio','marketing','profilazione','comunicazioni')),
  stato text NOT NULL CHECK (stato IN ('dato','revocato')),
  fonte text,
  data_consenso timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.privacy_consensi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all consensi" ON public.privacy_consensi FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CFO select consensi" ON public.privacy_consensi FOR SELECT USING (has_role(auth.uid(), 'cfo'));
CREATE POLICY "Ufficio select own consensi" ON public.privacy_consensi FOR SELECT
  USING (has_role(auth.uid(), 'ufficio') AND cliente_id IN (
    SELECT id FROM profiles WHERE ufficio_id = get_my_ufficio_id()
  ));
CREATE POLICY "Ufficio insert own consensi" ON public.privacy_consensi FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ufficio') AND cliente_id IN (
    SELECT id FROM profiles WHERE ufficio_id = get_my_ufficio_id()
  ));
CREATE POLICY "Produttore select own consensi" ON public.privacy_consensi FOR SELECT
  USING (has_role(auth.uid(), 'produttore') AND cliente_id IN (
    SELECT t.cliente_id FROM titoli t WHERE t.produttore_id = auth.uid() AND t.cliente_id IS NOT NULL
  ));
CREATE POLICY "Cliente select own consensi" ON public.privacy_consensi FOR SELECT
  USING (has_role(auth.uid(), 'cliente') AND cliente_id = auth.uid());

-- Funzione per verificare consenso marketing
CREATE OR REPLACE FUNCTION public.check_consenso_marketing(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM privacy_consensi pc
    WHERE pc.cliente_id = _cliente_id
      AND pc.tipo_consenso = 'marketing'
      AND pc.stato = 'dato'
      AND pc.data_consenso = (
        SELECT MAX(pc2.data_consenso)
        FROM privacy_consensi pc2
        WHERE pc2.cliente_id = _cliente_id
          AND pc2.tipo_consenso = 'marketing'
      )
  )
$$;
