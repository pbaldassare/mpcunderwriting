-- Movimenti bancari: collegamento conto, tracciabilità acconti, visibilità per sede via conto

ALTER TABLE public.movimenti_bancari
  ADD COLUMN IF NOT EXISTS conto_bancario_id uuid REFERENCES public.conti_bancari(id);

CREATE INDEX IF NOT EXISTS idx_movimenti_bancari_conto
  ON public.movimenti_bancari(conto_bancario_id);

ALTER TABLE public.cliente_anticipi
  ADD COLUMN IF NOT EXISTS movimento_bancario_id uuid REFERENCES public.movimenti_bancari(id);

CREATE INDEX IF NOT EXISTS idx_cliente_anticipi_movimento
  ON public.cliente_anticipi(movimento_bancario_id)
  WHERE movimento_bancario_id IS NOT NULL;

-- Visibilità sede anche tramite conto bancario collegato
DROP POLICY IF EXISTS "mb_sede_select" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_select" ON public.movimenti_bancari
  FOR SELECT TO authenticated
  USING (
    ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mb_sede_update" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_update" ON public.movimenti_bancari
  FOR UPDATE TO authenticated
  USING (
    ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Sede può inserire movimenti sul proprio conto (ricongiungimento / assegnazione pagatore)
DROP POLICY IF EXISTS "mb_sede_insert" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_insert" ON public.movimenti_bancari
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
    OR ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

COMMENT ON COLUMN public.movimenti_bancari.conto_bancario_id IS
  'Conto bancario Consulbrokers su cui è accreditato il bonifico; determina visibilità sede via conti_bancari_uffici.';

COMMENT ON COLUMN public.cliente_anticipi.movimento_bancario_id IS
  'Movimento bancario origine eccedenza (ricongiungimento).';
