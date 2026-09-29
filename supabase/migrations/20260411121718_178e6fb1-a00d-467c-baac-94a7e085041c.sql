
-- 1. Nuove colonne su trattative
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS ufficio_id uuid REFERENCES public.uffici(id);
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS data_apertura date DEFAULT CURRENT_DATE;
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS data_scadenza date;
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS priorita text DEFAULT 'media';
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS sottoprodotto text;
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS premio_effettivo numeric;
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS motivo_chiusura text;
ALTER TABLE public.trattative ADD COLUMN IF NOT EXISTS assegnato_a uuid REFERENCES public.profiles(id);

-- Indici
CREATE INDEX IF NOT EXISTS idx_trattative_ufficio ON public.trattative(ufficio_id);
CREATE INDEX IF NOT EXISTS idx_trattative_assegnato ON public.trattative(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_trattative_stato ON public.trattative(stato);

-- 2. Tabella trattativa_documenti
CREATE TABLE IF NOT EXISTS public.trattativa_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trattativa_id uuid NOT NULL REFERENCES public.trattative(id) ON DELETE CASCADE,
  nome_file text NOT NULL,
  file_path text NOT NULL,
  tipo_documento text DEFAULT 'altro',
  note text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trattativa_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trattativa_documenti"
  ON public.trattativa_documenti FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert trattativa_documenti"
  ON public.trattativa_documenti FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update trattativa_documenti"
  ON public.trattativa_documenti FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete trattativa_documenti"
  ON public.trattativa_documenti FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_trattativa_documenti_trattativa ON public.trattativa_documenti(trattativa_id);

-- 3. Tabella trattativa_eventi (timeline/log)
CREATE TABLE IF NOT EXISTS public.trattativa_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trattativa_id uuid NOT NULL REFERENCES public.trattative(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL DEFAULT 'nota',
  descrizione text NOT NULL,
  data_evento timestamptz DEFAULT now(),
  dettagli_json jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trattativa_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trattativa_eventi"
  ON public.trattativa_eventi FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert trattativa_eventi"
  ON public.trattativa_eventi FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update trattativa_eventi"
  ON public.trattativa_eventi FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete trattativa_eventi"
  ON public.trattativa_eventi FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_trattativa_eventi_trattativa ON public.trattativa_eventi(trattativa_id);
CREATE INDEX idx_trattativa_eventi_data ON public.trattativa_eventi(data_evento DESC);

-- 4. Tabella trattativa_scadenze
CREATE TABLE IF NOT EXISTS public.trattativa_scadenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trattativa_id uuid NOT NULL REFERENCES public.trattative(id) ON DELETE CASCADE,
  titolo text NOT NULL,
  data_scadenza date NOT NULL,
  completata boolean DEFAULT false,
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trattativa_scadenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trattativa_scadenze"
  ON public.trattativa_scadenze FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert trattativa_scadenze"
  ON public.trattativa_scadenze FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update trattativa_scadenze"
  ON public.trattativa_scadenze FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete trattativa_scadenze"
  ON public.trattativa_scadenze FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_trattativa_scadenze_trattativa ON public.trattativa_scadenze(trattativa_id);
CREATE INDEX idx_trattativa_scadenze_data ON public.trattativa_scadenze(data_scadenza);

-- 5. Validazione tipo_evento
CREATE OR REPLACE FUNCTION public.validate_trattativa_evento_tipo()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_evento NOT IN ('nota','telefonata','email','appuntamento','cambio_stato','documento','modifica') THEN
    RAISE EXCEPTION 'Invalid tipo_evento: %', NEW.tipo_evento;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_trattativa_evento_tipo
  BEFORE INSERT OR UPDATE ON public.trattativa_eventi
  FOR EACH ROW EXECUTE FUNCTION public.validate_trattativa_evento_tipo();

-- 6. Validazione priorita
CREATE OR REPLACE FUNCTION public.validate_trattativa_priorita()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.priorita IS NOT NULL AND NEW.priorita NOT IN ('bassa','media','alta','urgente') THEN
    RAISE EXCEPTION 'Invalid priorita: %', NEW.priorita;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_trattativa_priorita
  BEFORE INSERT OR UPDATE ON public.trattative
  FOR EACH ROW EXECUTE FUNCTION public.validate_trattativa_priorita();
