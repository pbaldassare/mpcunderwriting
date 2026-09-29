
CREATE TABLE public.causali_movimento_contabile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  segno text NOT NULL DEFAULT 'entrambi' CHECK (segno IN ('dare','avere','entrambi')),
  attiva boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.causali_movimento_contabile TO authenticated;
GRANT ALL ON public.causali_movimento_contabile TO service_role;

ALTER TABLE public.causali_movimento_contabile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read causali mov"
  ON public.causali_movimento_contabile FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin manage causali mov"
  ON public.causali_movimento_contabile FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_causali_mov_updated_at
  BEFORE UPDATE ON public.causali_movimento_contabile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.causali_movimento_contabile (codice, descrizione) VALUES
  ('ABP', 'ABBUONO PASSIVO'),
  ('AIN', 'ACCONTO SU INCASSI'),
  ('CAV', 'ABBUONO ATTIVO'),
  ('GGC', 'GIROCONTO'),
  ('GLP', 'LIQUIDAZIONE PROVVIGIONI'),
  ('MEN', 'MINOR INCASSO'),
  ('MIN', 'MAGGIORE INCASSO');
