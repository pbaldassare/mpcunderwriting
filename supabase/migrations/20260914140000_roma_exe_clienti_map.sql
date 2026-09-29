-- Mapping gestionale EXE (Roma EXE) → clienti CBnet.
-- Serve a collegare i 2053 codici EXE senza doppioni (match per CF/P.IVA).

CREATE TABLE IF NOT EXISTS public.roma_exe_clienti_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exe_codice text NOT NULL,
  exe_ragione_sociale text,
  cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  esito text NOT NULL CHECK (esito IN ('esistente', 'creata', 'saltata')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exe_codice)
);

CREATE INDEX IF NOT EXISTS roma_exe_clienti_map_cliente_idx
  ON public.roma_exe_clienti_map (cliente_id);

ALTER TABLE public.roma_exe_clienti_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roma_exe_clienti_map_select" ON public.roma_exe_clienti_map;
CREATE POLICY "roma_exe_clienti_map_select"
  ON public.roma_exe_clienti_map
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roma_exe_clienti_map_admin_write" ON public.roma_exe_clienti_map;
CREATE POLICY "roma_exe_clienti_map_admin_write"
  ON public.roma_exe_clienti_map
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.roma_exe_clienti_map IS
  'Collegamento codice cliente EXE Roma → anagrafica CBnet (sede RM2, senza doppioni).';
