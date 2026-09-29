-- ---------------------------------------------------------------------------
-- Specialist Sinistri ↔ Sedi (uffici)
--
-- Struttura dedicata per collegare utenti interni (profiles) alle sedi
-- di cui sono specialist sinistri. Distinta da profilo_sedi (visibilità
-- multi-sede generica) e dallo Specialist commerciale (ruolo backoffice).
--
-- Un profilo presente in questa tabella è uno Specialist Sinistri;
-- le righe definiscono le sedi di copertura (una primaria per profilo).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.specialist_sinistri_sedi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profilo_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ufficio_id uuid NOT NULL REFERENCES public.uffici(id) ON DELETE CASCADE,
  primaria boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT specialist_sinistri_sedi_unique UNIQUE (profilo_id, ufficio_id)
);

CREATE INDEX IF NOT EXISTS ix_specialist_sinistri_sedi_profilo
  ON public.specialist_sinistri_sedi (profilo_id);

CREATE INDEX IF NOT EXISTS ix_specialist_sinistri_sedi_ufficio
  ON public.specialist_sinistri_sedi (ufficio_id);

-- Al più una sede primaria per specialist
CREATE UNIQUE INDEX IF NOT EXISTS ux_specialist_sinistri_sedi_primaria
  ON public.specialist_sinistri_sedi (profilo_id)
  WHERE primaria = true;

COMMENT ON TABLE public.specialist_sinistri_sedi IS
  'Collegamento Specialist Sinistri (profiles) alle sedi (uffici) di copertura.';

ALTER TABLE public.specialist_sinistri_sedi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read specialist_sinistri_sedi"
  ON public.specialist_sinistri_sedi FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/ufficio can manage specialist_sinistri_sedi"
  ON public.specialist_sinistri_sedi FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ufficio')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ufficio')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_sinistri_sedi TO authenticated;
GRANT ALL ON public.specialist_sinistri_sedi TO service_role;
