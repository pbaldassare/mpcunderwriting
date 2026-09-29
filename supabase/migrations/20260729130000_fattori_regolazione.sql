-- Fattori di regolazione premio: catalogo, combinazioni sottoramo↔fattore, valori annuali su polizza

-- 1) Catalogo fattori (sostituisce dropdown hardcoded fatturato|num_dipendenti|retribuzioni|altro)
CREATE TABLE IF NOT EXISTS public.fattori_regolazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.fattori_regolazione IS
  'Catalogo fattori di regolazione premio (es. fatturato, retribuzioni).';

-- Seed legacy stabili
INSERT INTO public.fattori_regolazione (codice, descrizione, attivo)
VALUES
  ('fatturato', 'Fatturato', true),
  ('num_dipendenti', 'N° dipendenti', true),
  ('retribuzioni', 'Retribuzioni', true),
  ('altro', 'Altro', true)
ON CONFLICT (codice) DO NOTHING;

-- 2) Combinazioni sottoramo (rami) ↔ fattori
CREATE TABLE IF NOT EXISTS public.sottoramo_fattori_regolazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo_id uuid NOT NULL REFERENCES public.rami(id) ON DELETE CASCADE,
  fattore_id uuid NOT NULL REFERENCES public.fattori_regolazione(id) ON DELETE CASCADE,
  attivo boolean NOT NULL DEFAULT true,
  UNIQUE (ramo_id, fattore_id)
);

CREATE INDEX IF NOT EXISTS idx_sottoramo_fattori_regolazione_ramo
  ON public.sottoramo_fattori_regolazione(ramo_id);

COMMENT ON TABLE public.sottoramo_fattori_regolazione IS
  'Fattori di regolazione abilitati per sottoramo (public.rami).';

-- 3) Valori operativi annuali sulla polizza
CREATE TABLE IF NOT EXISTS public.titoli_regolazione_fattori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  ramo_id uuid NOT NULL REFERENCES public.rami(id),
  fattore_id uuid NOT NULL REFERENCES public.fattori_regolazione(id),
  importo_esposto numeric NOT NULL DEFAULT 0,
  anno integer NOT NULL,
  data_presunta date NULL,
  note text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (titolo_id, fattore_id, anno)
);

CREATE INDEX IF NOT EXISTS idx_titoli_regolazione_fattori_titolo
  ON public.titoli_regolazione_fattori(titolo_id);

CREATE INDEX IF NOT EXISTS idx_titoli_regolazione_fattori_ramo
  ON public.titoli_regolazione_fattori(ramo_id);

COMMENT ON TABLE public.titoli_regolazione_fattori IS
  'Importi esposti per fattore×anno sulla polizza in regolazione.';

DROP TRIGGER IF EXISTS trg_titoli_regolazione_fattori_updated_at ON public.titoli_regolazione_fattori;
CREATE TRIGGER trg_titoli_regolazione_fattori_updated_at
  BEFORE UPDATE ON public.titoli_regolazione_fattori
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Compat: titoli.regolazione_fattore resta nullable senza CHECK sui soli valori legacy
ALTER TABLE public.titoli
  DROP CONSTRAINT IF EXISTS chk_titoli_regolazione_fattore;

-- RLS
ALTER TABLE public.fattori_regolazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sottoramo_fattori_regolazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titoli_regolazione_fattori ENABLE ROW LEVEL SECURITY;

-- Catalogo: lettura autenticati, scrittura admin (pattern lookup_*)
DROP POLICY IF EXISTS "fattori_regolazione_read" ON public.fattori_regolazione;
CREATE POLICY "fattori_regolazione_read" ON public.fattori_regolazione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fattori_regolazione_all_admin" ON public.fattori_regolazione;
CREATE POLICY "fattori_regolazione_all_admin" ON public.fattori_regolazione
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sottoramo_fattori_regolazione_read" ON public.sottoramo_fattori_regolazione;
CREATE POLICY "sottoramo_fattori_regolazione_read" ON public.sottoramo_fattori_regolazione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sottoramo_fattori_regolazione_all_admin" ON public.sottoramo_fattori_regolazione;
CREATE POLICY "sottoramo_fattori_regolazione_all_admin" ON public.sottoramo_fattori_regolazione
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Valori polizza: autenticati (allineato a premi_garanzia_polizza / livella RLS)
DROP POLICY IF EXISTS "Authenticated full access titoli_regolazione_fattori" ON public.titoli_regolazione_fattori;
CREATE POLICY "Authenticated full access titoli_regolazione_fattori" ON public.titoli_regolazione_fattori
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fattori_regolazione TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sottoramo_fattori_regolazione TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titoli_regolazione_fattori TO authenticated;
