-- Sinistri: aperto_da_user_id + prescrizioni perentorie + reminder personali

ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS aperto_da_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sinistri_aperto_da ON public.sinistri(aperto_da_user_id);

-- Backfill creatore da log_attivita
UPDATE public.sinistri s
SET aperto_da_user_id = la.user_id
FROM (
  SELECT DISTINCT ON (entita_id) entita_id, user_id
  FROM public.log_attivita
  WHERE entita_tipo = 'sinistro' AND azione = 'creazione_sinistro' AND user_id IS NOT NULL
  ORDER BY entita_id, created_at ASC
) la
WHERE s.id = la.entita_id AND s.aperto_da_user_id IS NULL;

-- ---------------------------------------------------------------------------
-- Prescrizioni perentorie (comunicazioni con scadenza risposta)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sinistro_prescrizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistri(id) ON DELETE CASCADE,
  creato_da uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_tipo text NOT NULL DEFAULT 'cliente'
    CHECK (destinatario_tipo IN ('cliente', 'compagnia', 'perito', 'controparte', 'altro')),
  destinatario_label text,
  oggetto text NOT NULL,
  corpo text,
  data_invio date,
  data_scadenza_risposta date NOT NULL,
  stato text NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza', 'inviata', 'risposta_ricevuta', 'scaduta')),
  canale text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sinistro_prescrizioni_sinistro ON public.sinistro_prescrizioni(sinistro_id);
CREATE INDEX IF NOT EXISTS idx_sinistro_prescrizioni_scadenza ON public.sinistro_prescrizioni(data_scadenza_risposta);
CREATE INDEX IF NOT EXISTS idx_sinistro_prescrizioni_stato ON public.sinistro_prescrizioni(stato);

ALTER TABLE public.sinistro_prescrizioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_admin_all" ON public.sinistro_prescrizioni
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sp_cfo_select" ON public.sinistro_prescrizioni
  FOR SELECT USING (public.has_role(auth.uid(), 'cfo'));

CREATE POLICY "sp_ufficio_select" ON public.sinistro_prescrizioni
  FOR SELECT USING (
    sinistro_id IN (SELECT id FROM public.sinistri WHERE ufficio_id = public.get_my_ufficio_id())
  );

CREATE POLICY "sp_ufficio_insert" ON public.sinistro_prescrizioni
  FOR INSERT WITH CHECK (
    creato_da = auth.uid()
    AND sinistro_id IN (
      SELECT s.id FROM public.sinistri s
      WHERE s.aperto_da_user_id = auth.uid()
         OR s.ufficio_id = public.get_my_ufficio_id()
    )
  );

CREATE POLICY "sp_ufficio_update" ON public.sinistro_prescrizioni
  FOR UPDATE USING (
    creato_da = auth.uid()
    OR sinistro_id IN (SELECT id FROM public.sinistri WHERE aperto_da_user_id = auth.uid())
  );

CREATE POLICY "sp_ufficio_delete" ON public.sinistro_prescrizioni
  FOR DELETE USING (
    creato_da = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinistro_prescrizioni TO authenticated;
GRANT ALL ON public.sinistro_prescrizioni TO service_role;

-- ---------------------------------------------------------------------------
-- Reminder personali (solo creatore sinistro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sinistro_reminder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistri(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  testo text NOT NULL,
  data_promemoria date,
  completato boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_sinistro ON public.sinistro_reminder(sinistro_id);
CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_user ON public.sinistro_reminder(user_id);
CREATE INDEX IF NOT EXISTS idx_sinistro_reminder_promemoria ON public.sinistro_reminder(data_promemoria);

ALTER TABLE public.sinistro_reminder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sr_admin_all" ON public.sinistro_reminder
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sr_owner_all" ON public.sinistro_reminder
  FOR ALL USING (
    user_id = auth.uid()
    AND sinistro_id IN (SELECT id FROM public.sinistri WHERE aperto_da_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND sinistro_id IN (SELECT id FROM public.sinistri WHERE aperto_da_user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinistro_reminder TO authenticated;
GRANT ALL ON public.sinistro_reminder TO service_role;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.trg_sinistro_prescrizioni_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS sinistro_prescrizioni_updated ON public.sinistro_prescrizioni;
CREATE TRIGGER sinistro_prescrizioni_updated
  BEFORE UPDATE ON public.sinistro_prescrizioni
  FOR EACH ROW EXECUTE FUNCTION public.trg_sinistro_prescrizioni_updated();

CREATE OR REPLACE FUNCTION public.trg_sinistro_reminder_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS sinistro_reminder_updated ON public.sinistro_reminder;
CREATE TRIGGER sinistro_reminder_updated
  BEFORE UPDATE ON public.sinistro_reminder
  FOR EACH ROW EXECUTE FUNCTION public.trg_sinistro_reminder_updated();

-- Marca prescrizioni scadute (job manuale o cron)
CREATE OR REPLACE FUNCTION public.aggiorna_prescrizioni_scadute()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.sinistro_prescrizioni
  SET stato = 'scaduta', updated_at = now()
  WHERE stato = 'inviata'
    AND data_scadenza_risposta < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggiorna_prescrizioni_scadute() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggiorna_prescrizioni_scadute() TO service_role;
