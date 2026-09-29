-- Libro matricola: progressivo mezzi, uso FK, storico operazioni

ALTER TABLE public.libro_matricola_mezzi
  ADD COLUMN IF NOT EXISTS n_progressivo integer,
  ADD COLUMN IF NOT EXISTS uso_id uuid REFERENCES public.rca_usi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_libro_matricola_mezzi_uso ON public.libro_matricola_mezzi(uso_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_libro_matricola_mezzi_titolo_prog
  ON public.libro_matricola_mezzi(titolo_id, n_progressivo)
  WHERE n_progressivo IS NOT NULL;

COMMENT ON COLUMN public.libro_matricola_mezzi.n_progressivo IS 'Numero progressivo mezzo per polizza (1..N)';
COMMENT ON COLUMN public.libro_matricola_mezzi.uso_id IS 'FK uso RCA (rca_usi)';

-- Backfill progressivi esistenti per titolo
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY titolo_id
           ORDER BY data_inclusione NULLS LAST, created_at, targa
         ) AS rn
  FROM public.libro_matricola_mezzi
  WHERE n_progressivo IS NULL
)
UPDATE public.libro_matricola_mezzi m
SET n_progressivo = ranked.rn
FROM ranked
WHERE m.id = ranked.id;

CREATE TABLE IF NOT EXISTS public.libro_matricola_operazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  mezzo_id uuid REFERENCES public.libro_matricola_mezzi(id) ON DELETE SET NULL,
  n_operazione integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('inclusione', 'esclusione', 'modifica', 'import', 'creazione', 'eliminazione')),
  data_evento date,
  targa text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_libro_matricola_operazioni_titolo
  ON public.libro_matricola_operazioni(titolo_id, n_operazione);

CREATE UNIQUE INDEX IF NOT EXISTS uq_libro_matricola_operazioni_titolo_n
  ON public.libro_matricola_operazioni(titolo_id, n_operazione);

ALTER TABLE public.libro_matricola_operazioni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage libro_matricola_operazioni" ON public.libro_matricola_operazioni;
CREATE POLICY "Staff manage libro_matricola_operazioni"
  ON public.libro_matricola_operazioni
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libro_matricola_operazioni TO authenticated;
GRANT ALL ON public.libro_matricola_operazioni TO service_role;
