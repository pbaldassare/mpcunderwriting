CREATE TABLE public.appendici_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  numero_appendice text NOT NULL,
  data_appendice date DEFAULT CURRENT_DATE,
  data_effetto date,
  oggetto text,
  testo text,
  tipo text DEFAULT 'modifica',
  file_path text,
  nome_file text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.appendici_polizza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.appendici_polizza
  FOR ALL TO authenticated USING (true) WITH CHECK (true);