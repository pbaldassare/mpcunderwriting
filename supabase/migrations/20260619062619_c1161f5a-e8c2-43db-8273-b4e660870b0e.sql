CREATE OR REPLACE FUNCTION public.set_updated_at_lmm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.libro_matricola_mezzi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  targa text,
  data_inclusione date,
  data_esclusione date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_libro_matricola_mezzi_titolo ON public.libro_matricola_mezzi(titolo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libro_matricola_mezzi TO authenticated;
GRANT ALL ON public.libro_matricola_mezzi TO service_role;

ALTER TABLE public.libro_matricola_mezzi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lmm_select_auth" ON public.libro_matricola_mezzi FOR SELECT TO authenticated USING (true);
CREATE POLICY "lmm_insert_auth" ON public.libro_matricola_mezzi FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lmm_update_auth" ON public.libro_matricola_mezzi FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lmm_delete_auth" ON public.libro_matricola_mezzi FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_libro_matricola_mezzi_updated_at
  BEFORE UPDATE ON public.libro_matricola_mezzi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_lmm();