-- Storico carichi Excel movimenti bancari + scarti import + legame su movimenti

CREATE TABLE IF NOT EXISTS public.movimenti_bancari_carichi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_file text NOT NULL,
  conto_bancario_id uuid REFERENCES public.conti_bancari(id),
  caricato_da uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  righe_file integer NOT NULL DEFAULT 0,
  righe_inserite integer NOT NULL DEFAULT 0,
  righe_duplicati integer NOT NULL DEFAULT 0,
  righe_scartate integer NOT NULL DEFAULT 0,
  righe_senza_cliente integer NOT NULL DEFAULT 0,
  note text
);

COMMENT ON TABLE public.movimenti_bancari_carichi IS
  'Batch di import Excel estratto conto: storico carichi e KPI.';

CREATE INDEX IF NOT EXISTS idx_mb_carichi_created
  ON public.movimenti_bancari_carichi(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mb_carichi_conto
  ON public.movimenti_bancari_carichi(conto_bancario_id);

CREATE TABLE IF NOT EXISTS public.movimenti_bancari_carichi_scarti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carico_id uuid NOT NULL REFERENCES public.movimenti_bancari_carichi(id) ON DELETE CASCADE,
  riga_excel integer,
  motivo text NOT NULL,
  data_movimento text,
  importo numeric,
  ordinante text,
  descrizione text,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.movimenti_bancari_carichi_scarti IS
  'Righe Excel non inserite (duplicato, importo zero, parse fallito, ecc.).';

CREATE INDEX IF NOT EXISTS idx_mb_carichi_scarti_carico
  ON public.movimenti_bancari_carichi_scarti(carico_id);

ALTER TABLE public.movimenti_bancari
  ADD COLUMN IF NOT EXISTS carico_id uuid REFERENCES public.movimenti_bancari_carichi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimenti_bancari_carico
  ON public.movimenti_bancari(carico_id)
  WHERE carico_id IS NOT NULL;

COMMENT ON COLUMN public.movimenti_bancari.carico_id IS
  'Carico Excel di provenienza; NULL = inserimento manuale o legacy.';

-- RLS: admin/cfo (come pagina Caricamento) + select per chi vede i movimenti del conto
ALTER TABLE public.movimenti_bancari_carichi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimenti_bancari_carichi_scarti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mb_carichi_select" ON public.movimenti_bancari_carichi;
CREATE POLICY "mb_carichi_select" ON public.movimenti_bancari_carichi
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari_carichi.conto_bancario_id
        AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mb_carichi_insert" ON public.movimenti_bancari_carichi;
CREATE POLICY "mb_carichi_insert" ON public.movimenti_bancari_carichi
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
  );

DROP POLICY IF EXISTS "mb_carichi_update" ON public.movimenti_bancari_carichi;
CREATE POLICY "mb_carichi_update" ON public.movimenti_bancari_carichi
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
  );

DROP POLICY IF EXISTS "mb_carichi_scarti_select" ON public.movimenti_bancari_carichi_scarti;
CREATE POLICY "mb_carichi_scarti_select" ON public.movimenti_bancari_carichi_scarti
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.movimenti_bancari_carichi c
      WHERE c.id = movimenti_bancari_carichi_scarti.carico_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'cfo'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = c.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "mb_carichi_scarti_insert" ON public.movimenti_bancari_carichi_scarti;
CREATE POLICY "mb_carichi_scarti_insert" ON public.movimenti_bancari_carichi_scarti
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cfo'::public.app_role)
  );

GRANT SELECT, INSERT, UPDATE ON public.movimenti_bancari_carichi TO authenticated;
GRANT SELECT, INSERT ON public.movimenti_bancari_carichi_scarti TO authenticated;
