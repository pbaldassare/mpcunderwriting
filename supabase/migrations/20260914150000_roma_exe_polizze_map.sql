-- Mapping gestionale EXE (Roma EXE) → polizze/quietanze CBnet (titoli).

CREATE TABLE IF NOT EXISTS public.roma_exe_polizze_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exe_chiave text NOT NULL UNIQUE,
  exe_numero text,
  exe_tipo text NOT NULL CHECK (exe_tipo IN ('polizza', 'quietanza')),
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  esito text NOT NULL CHECK (esito IN ('creata', 'saltata')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roma_exe_polizze_map_titolo_idx
  ON public.roma_exe_polizze_map (titolo_id);

CREATE INDEX IF NOT EXISTS roma_exe_polizze_map_numero_idx
  ON public.roma_exe_polizze_map (exe_numero);

ALTER TABLE public.roma_exe_polizze_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roma_exe_polizze_map_select" ON public.roma_exe_polizze_map;
CREATE POLICY "roma_exe_polizze_map_select"
  ON public.roma_exe_polizze_map
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roma_exe_polizze_map_admin_write" ON public.roma_exe_polizze_map;
CREATE POLICY "roma_exe_polizze_map_admin_write"
  ON public.roma_exe_polizze_map
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.roma_exe_polizze_map IS
  'Collegamento polizze/sospesi EXE Roma → titoli CBnet (madri + quietanze sospese).';
