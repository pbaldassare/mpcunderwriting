
-- Add nome column to gruppi_finanziari
ALTER TABLE public.gruppi_finanziari ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT '';

-- Insert demo gruppi finanziari
INSERT INTO public.gruppi_finanziari (codice, nome, descrizione) VALUES
  ('ISP', 'Intesa Sanpaolo S.p.A.', 'Gruppo bancario — credito, assicurazioni, asset management'),
  ('UCG', 'UniCredit S.p.A.', 'Gruppo bancario internazionale con sede a Milano'),
  ('MPS', 'Banca Monte dei Paschi di Siena', 'Banca commerciale storica toscana'),
  ('GEN', 'Assicurazioni Generali S.p.A.', 'Gruppo assicurativo — vita, danni, previdenza'),
  ('AZI', 'Allianz S.p.A.', 'Filiale italiana del gruppo assicurativo tedesco'),
  ('CDP', 'Cassa Depositi e Prestiti', 'Ente pubblico — finanziamento infrastrutture e PA'),
  ('INPS', 'INPS', 'Istituto Nazionale Previdenza Sociale'),
  ('INAIL', 'INAIL', 'Istituto Nazionale Assicurazione Infortuni sul Lavoro')
ON CONFLICT DO NOTHING;
