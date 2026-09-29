
-- Aggiunge il campo "tipo" sulle agenzie (compagnie) per distinguere
-- Agenzia / Broker / Direzione / Plurimandataria, e tabella di backup
-- per la pulizia dei doppioni e non operativi.

ALTER TABLE public.compagnie
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'agenzia';

ALTER TABLE public.compagnie
  DROP CONSTRAINT IF EXISTS compagnie_tipo_check;

ALTER TABLE public.compagnie
  ADD CONSTRAINT compagnie_tipo_check
  CHECK (tipo IN ('agenzia','broker','direzione','plurimandataria'));

CREATE INDEX IF NOT EXISTS idx_compagnie_tipo ON public.compagnie(tipo);

-- Tabella di backup dei record eliminati durante la pulizia 2026-05
CREATE TABLE IF NOT EXISTS public._backup_compagnie_cleanup_20260516 (
  source_table text,
  payload jsonb,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._backup_compagnie_cleanup_20260516 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Solo admin legge backup" ON public._backup_compagnie_cleanup_20260516;
CREATE POLICY "Solo admin legge backup"
  ON public._backup_compagnie_cleanup_20260516 FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
