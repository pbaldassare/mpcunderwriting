
-- 1) Tabella prospect
CREATE TABLE public.prospect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  cognome text,
  email text,
  telefono text,
  fonte text,
  stato text NOT NULL DEFAULT 'nuovo' CHECK (stato IN ('nuovo','in_trattativa','preventivo_inviato','chiuso_vinto','chiuso_perso')),
  assegnato_a uuid REFERENCES public.profiles(id),
  ufficio_id uuid REFERENCES public.uffici(id),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prospect ENABLE ROW LEVEL SECURITY;

-- 2) Tabella trattative
CREATE TABLE public.trattative (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.prospect(id) ON DELETE CASCADE,
  prodotto text,
  compagnia text,
  premio_previsto numeric,
  stato text NOT NULL DEFAULT 'aperta' CHECK (stato IN ('aperta','in_negoziazione','chiusa_vinta','chiusa_persa')),
  data_chiusura timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.trattative ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_prospect_stato ON public.prospect(stato);
CREATE INDEX idx_prospect_assegnato ON public.prospect(assegnato_a);
CREATE INDEX idx_prospect_ufficio ON public.prospect(ufficio_id);
CREATE INDEX idx_trattative_prospect ON public.trattative(prospect_id);
CREATE INDEX idx_trattative_stato ON public.trattative(stato);

-- ===================== RLS PROSPECT =====================

-- Admin: tutto
CREATE POLICY "Admin all prospect" ON public.prospect
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CFO: solo select
CREATE POLICY "CFO select prospect" ON public.prospect
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'cfo'));

-- Ufficio: solo proprio ufficio
CREATE POLICY "Ufficio select own prospect" ON public.prospect
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ufficio')
    AND ufficio_id = public.get_my_ufficio_id()
  );

CREATE POLICY "Ufficio insert own prospect" ON public.prospect
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ufficio')
    AND ufficio_id = public.get_my_ufficio_id()
  );

CREATE POLICY "Ufficio update own prospect" ON public.prospect
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ufficio')
    AND ufficio_id = public.get_my_ufficio_id()
  );

-- Produttore: solo assegnati a sé
CREATE POLICY "Produttore select own prospect" ON public.prospect
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'produttore')
    AND assegnato_a = auth.uid()
  );

CREATE POLICY "Produttore insert own prospect" ON public.prospect
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'produttore')
    AND assegnato_a = auth.uid()
  );

CREATE POLICY "Produttore update own prospect" ON public.prospect
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'produttore')
    AND assegnato_a = auth.uid()
  );

-- ===================== RLS TRATTATIVE =====================

-- Admin: tutto
CREATE POLICY "Admin all trattative" ON public.trattative
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CFO: solo select
CREATE POLICY "CFO select trattative" ON public.trattative
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'cfo'));

-- Ufficio: trattative del proprio ufficio (via prospect)
CREATE POLICY "Ufficio select own trattative" ON public.trattative
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ufficio')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE ufficio_id = public.get_my_ufficio_id()
    )
  );

CREATE POLICY "Ufficio insert own trattative" ON public.trattative
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ufficio')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE ufficio_id = public.get_my_ufficio_id()
    )
  );

CREATE POLICY "Ufficio update own trattative" ON public.trattative
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ufficio')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE ufficio_id = public.get_my_ufficio_id()
    )
  );

-- Produttore: trattative dei propri prospect
CREATE POLICY "Produttore select own trattative" ON public.trattative
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'produttore')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE assegnato_a = auth.uid()
    )
  );

CREATE POLICY "Produttore insert own trattative" ON public.trattative
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'produttore')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE assegnato_a = auth.uid()
    )
  );

CREATE POLICY "Produttore update own trattative" ON public.trattative
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'produttore')
    AND prospect_id IN (
      SELECT id FROM public.prospect WHERE assegnato_a = auth.uid()
    )
  );
