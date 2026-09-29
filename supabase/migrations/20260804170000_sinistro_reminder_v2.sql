-- Sinistro reminder v2: assegnazione responsabile, categoria, scadenza obbligatoria, letto/popup

-- Nuove colonne
ALTER TABLE public.sinistro_reminder
  ADD COLUMN IF NOT EXISTS assegnato_a uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creato_da uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'altro',
  ADD COLUMN IF NOT EXISTS stato text NOT NULL DEFAULT 'attivo',
  ADD COLUMN IF NOT EXISTS letto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_mostrato_at timestamptz,
  ADD COLUMN IF NOT EXISTS titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_scadenza date;

-- Backfill da schema v1
UPDATE public.sinistro_reminder r
SET
  creato_da = COALESCE(r.creato_da, r.user_id),
  assegnato_a = COALESCE(
    r.assegnato_a,
    (SELECT s.responsabile_id FROM public.sinistri s WHERE s.id = r.sinistro_id),
    r.user_id
  ),
  titolo_id = COALESCE(r.titolo_id, (SELECT s.titolo_id FROM public.sinistri s WHERE s.id = r.sinistro_id)),
  cliente_id = COALESCE(r.cliente_id, (SELECT s.cliente_anagrafica_id FROM public.sinistri s WHERE s.id = r.sinistro_id)),
  data_scadenza = COALESCE(r.data_scadenza, r.data_promemoria, (CURRENT_DATE + interval '7 days')::date),
  stato = CASE
    WHEN r.completato THEN 'completato'
    WHEN r.stato IS NOT NULL AND r.stato <> 'attivo' THEN r.stato
    ELSE 'attivo'
  END
WHERE r.creato_da IS NULL OR r.assegnato_a IS NULL OR r.data_scadenza IS NULL;

-- Rinomina colonna legacy (mantieni per compatibilità lettura)
-- data_promemoria resta sincronizzata via trigger
CREATE OR REPLACE FUNCTION public.trg_sinistro_reminder_sync_scadenza()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_scadenza IS NOT NULL THEN
    NEW.data_promemoria := NEW.data_scadenza;
  ELSIF NEW.data_promemoria IS NOT NULL AND NEW.data_scadenza IS NULL THEN
    NEW.data_scadenza := NEW.data_promemoria;
  END IF;
  IF NEW.creato_da IS NULL THEN NEW.creato_da := NEW.user_id; END IF;
  IF NEW.user_id IS NULL THEN NEW.user_id := NEW.creato_da; END IF;
  IF NEW.completato AND NEW.stato = 'attivo' THEN NEW.stato := 'completato'; END IF;
  IF NEW.stato = 'completato' THEN NEW.completato := true; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sinistro_reminder_sync_scadenza ON public.sinistro_reminder;
CREATE TRIGGER sinistro_reminder_sync_scadenza
  BEFORE INSERT OR UPDATE ON public.sinistro_reminder
  FOR EACH ROW EXECUTE FUNCTION public.trg_sinistro_reminder_sync_scadenza();

-- Vincoli
ALTER TABLE public.sinistro_reminder
  ALTER COLUMN data_scadenza SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sinistro_reminder_stato_check'
  ) THEN
    ALTER TABLE public.sinistro_reminder
      ADD CONSTRAINT sinistro_reminder_stato_check
      CHECK (stato IN ('attivo', 'completato', 'annullato'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sinistro_reminder_categoria_check'
  ) THEN
    ALTER TABLE public.sinistro_reminder
      ADD CONSTRAINT sinistro_reminder_categoria_check
      CHECK (categoria IN ('documenti', 'follow_up', 'perizia', 'contatto_cliente', 'altro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_assegnato ON public.sinistro_reminder(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_scadenza ON public.sinistro_reminder(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_stato ON public.sinistro_reminder(stato);

-- RLS allineata agli altri moduli sinistri (tutti autenticati)
DROP POLICY IF EXISTS "sr_admin_all" ON public.sinistro_reminder;
DROP POLICY IF EXISTS "sr_owner_all" ON public.sinistro_reminder;

CREATE POLICY "Authenticated full access sinistro_reminder" ON public.sinistro_reminder
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
