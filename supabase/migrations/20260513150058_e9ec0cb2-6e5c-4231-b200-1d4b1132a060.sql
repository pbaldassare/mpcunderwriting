ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS frazionamento text;
ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_frazionamento_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_frazionamento_check
  CHECK (frazionamento IS NULL OR frazionamento IN ('Mensile','Trimestrale','Quadrimestrale','Semestrale','Annuale','Poliennale'));