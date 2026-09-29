-- Mapping gestionale EXE (Roma EXE) → compagnie CBnet.
-- Serve a collegare i 177 codici EXE (e i nomi in polizza) senza doppioni.

CREATE TABLE IF NOT EXISTS public.roma_exe_compagnie_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exe_codice text,
  exe_nome text NOT NULL,
  exe_nome_norm text NOT NULL,
  compagnia_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  esito text NOT NULL CHECK (esito IN ('esistente', 'creata', 'saltata')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roma_exe_compagnie_map_codice_uidx
  ON public.roma_exe_compagnie_map (exe_codice)
  WHERE exe_codice IS NOT NULL;

CREATE INDEX IF NOT EXISTS roma_exe_compagnie_map_norm_idx
  ON public.roma_exe_compagnie_map (exe_nome_norm);

CREATE INDEX IF NOT EXISTS roma_exe_compagnie_map_compagnia_idx
  ON public.roma_exe_compagnie_map (compagnia_id);

ALTER TABLE public.roma_exe_compagnie_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roma_exe_compagnie_map_select" ON public.roma_exe_compagnie_map;
CREATE POLICY "roma_exe_compagnie_map_select"
  ON public.roma_exe_compagnie_map
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roma_exe_compagnie_map_admin_write" ON public.roma_exe_compagnie_map;
CREATE POLICY "roma_exe_compagnie_map_admin_write"
  ON public.roma_exe_compagnie_map
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.roma_exe_compagnie_map IS
  'Collegamento ragione sociale/codice EXE Roma → compagnie CBnet (senza doppioni).';
