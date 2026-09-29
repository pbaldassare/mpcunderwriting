-- Titoli di nidificazione (incarico / familiare / societario) e validazione relazioni cliente.

CREATE TABLE IF NOT EXISTS public.lookup_titoli_nidificazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  preposizione text NOT NULL DEFAULT 'di',
  categoria text NOT NULL CHECK (categoria IN ('incarico', 'familiare', 'societario')),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lookup_titoli_nidificazione ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lookup_titoli_nidificazione"
ON public.lookup_titoli_nidificazione FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert lookup_titoli_nidificazione"
ON public.lookup_titoli_nidificazione FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update lookup_titoli_nidificazione"
ON public.lookup_titoli_nidificazione FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete lookup_titoli_nidificazione"
ON public.lookup_titoli_nidificazione FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.lookup_titoli_nidificazione (codice, descrizione, preposizione, categoria) VALUES
  ('sindaco', 'Sindaco', 'di', 'incarico'),
  ('vicesindaco', 'Vicesindaco', 'di', 'incarico'),
  ('assessore', 'Assessore', 'di', 'incarico'),
  ('presidente', 'Presidente', 'di', 'incarico'),
  ('legale_rappresentante', 'Legale rappresentante', 'di', 'incarico'),
  ('referente', 'Referente', 'di', 'incarico'),
  ('dipendente', 'Dipendente', 'di', 'incarico'),
  ('figlio', 'Figlio', 'di', 'familiare'),
  ('figlia', 'Figlia', 'di', 'familiare'),
  ('genitore', 'Genitore', 'di', 'familiare'),
  ('coniuge', 'Coniuge', 'di', 'familiare'),
  ('fratello', 'Fratello', 'di', 'familiare'),
  ('sorella', 'Sorella', 'di', 'familiare'),
  ('nonno', 'Nonno', 'di', 'familiare'),
  ('nonna', 'Nonna', 'di', 'familiare'),
  ('socio', 'Socio', 'di', 'societario')
ON CONFLICT (codice) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_clienti_relazioni_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cliente_id = NEW.cliente_collegato_id THEN
    RAISE EXCEPTION 'Cannot create self-relation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lookup_titoli_nidificazione t
    WHERE t.codice = NEW.tipo_relazione AND t.attivo = true
  ) THEN
    RAISE EXCEPTION 'Invalid tipo_relazione: %', NEW.tipo_relazione;
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT r.cliente_collegato_id AS id
      FROM public.clienti_relazioni r
      WHERE r.cliente_id = NEW.cliente_collegato_id
        AND r.id IS DISTINCT FROM NEW.id
      UNION
      SELECT r.cliente_collegato_id
      FROM public.clienti_relazioni r
      JOIN ancestors a ON r.cliente_id = a.id
      WHERE r.id IS DISTINCT FROM NEW.id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'Nidificazione ciclica non consentita';
  END IF;

  RETURN NEW;
END;
$$;
