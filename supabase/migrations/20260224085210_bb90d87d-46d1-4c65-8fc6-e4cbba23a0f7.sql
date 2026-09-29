
-- Tabella notifiche
CREATE TABLE public.notifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ufficio_id uuid REFERENCES public.uffici(id),
  tipo text NOT NULL,
  titolo text NOT NULL,
  messaggio text NOT NULL,
  entita_tipo text,
  entita_id uuid,
  priorita text NOT NULL DEFAULT 'media',
  letto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for priorita
CREATE OR REPLACE FUNCTION public.validate_notifiche_priorita()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.priorita NOT IN ('bassa','media','alta') THEN
    RAISE EXCEPTION 'Invalid priorita: %', NEW.priorita;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_notifiche_priorita
  BEFORE INSERT OR UPDATE ON public.notifiche
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_notifiche_priorita();

-- Indici
CREATE INDEX idx_notifiche_destinatario ON public.notifiche(destinatario_id);
CREATE INDEX idx_notifiche_letto ON public.notifiche(destinatario_id, letto);
CREATE INDEX idx_notifiche_tipo ON public.notifiche(tipo);
CREATE INDEX idx_notifiche_created ON public.notifiche(created_at DESC);

-- RLS
ALTER TABLE public.notifiche ENABLE ROW LEVEL SECURITY;

-- Utente vede solo proprie notifiche
CREATE POLICY "User select own notifiche"
  ON public.notifiche FOR SELECT
  USING (destinatario_id = auth.uid());

-- Utente aggiorna solo proprie (per segnare letto)
CREATE POLICY "User update own notifiche"
  ON public.notifiche FOR UPDATE
  USING (destinatario_id = auth.uid());

-- Admin vede tutte
CREATE POLICY "Admin select all notifiche"
  ON public.notifiche FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin insert (per generare notifiche)
CREATE POLICY "Admin insert notifiche"
  ON public.notifiche FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- CFO vede tutte
CREATE POLICY "CFO select all notifiche"
  ON public.notifiche FOR SELECT
  USING (public.has_role(auth.uid(), 'cfo'::app_role));

-- Contabilita insert (per notifiche banca)
CREATE POLICY "Contabilita insert notifiche"
  ON public.notifiche FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'contabilita'::app_role));

-- Ufficio insert (per notifiche proprie)
CREATE POLICY "Ufficio insert notifiche"
  ON public.notifiche FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ufficio'::app_role));

-- Authenticated insert own notifiche
CREATE POLICY "Authenticated insert own notifiche"
  ON public.notifiche FOR INSERT
  WITH CHECK (destinatario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
