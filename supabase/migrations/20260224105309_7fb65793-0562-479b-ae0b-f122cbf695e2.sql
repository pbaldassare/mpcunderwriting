
-- Add ufficio_id and severity to log_attivita
ALTER TABLE public.log_attivita
  ADD COLUMN IF NOT EXISTS ufficio_id uuid REFERENCES public.uffici(id),
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';

-- Validation trigger for severity
CREATE OR REPLACE FUNCTION public.validate_log_attivita_severity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.severity NOT IN ('info','warning','critical') THEN
    RAISE EXCEPTION 'Invalid severity: %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_log_attivita_severity
  BEFORE INSERT OR UPDATE ON public.log_attivita
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_log_attivita_severity();

-- Index for timeline queries
CREATE INDEX IF NOT EXISTS idx_log_attivita_entita ON public.log_attivita(entita_tipo, entita_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_attivita_ufficio ON public.log_attivita(ufficio_id);

-- Update RLS: add ufficio-based select policy
-- Drop existing ufficio-related policy if needed and recreate
CREATE POLICY "Ufficio select own logs"
  ON public.log_attivita
  FOR SELECT
  USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- Produttore select logs for own entities
CREATE POLICY "Produttore select own entity logs"
  ON public.log_attivita
  FOR SELECT
  USING (
    has_role(auth.uid(), 'produttore'::app_role) AND (
      (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE produttore_id = auth.uid()))
      OR (entita_tipo = 'prospect' AND entita_id IN (SELECT id FROM prospect WHERE assegnato_a = auth.uid()))
      OR user_id = auth.uid()
    )
  );

-- Cliente select logs for own entities
CREATE POLICY "Cliente select own entity logs"
  ON public.log_attivita
  FOR SELECT
  USING (
    has_role(auth.uid(), 'cliente'::app_role) AND (
      (entita_tipo = 'titolo' AND entita_id IN (SELECT id FROM titoli WHERE cliente_id = auth.uid()))
      OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT id FROM sinistri WHERE cliente_id = auth.uid()))
    )
  );
