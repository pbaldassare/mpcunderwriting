
-- Tabella impostazioni_sistema
CREATE TABLE public.impostazioni_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chiave text UNIQUE NOT NULL,
  valore_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  descrizione text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.impostazioni_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all impostazioni_sistema" ON public.impostazioni_sistema FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFO select impostazioni_sistema" ON public.impostazioni_sistema FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));

-- Tabella impostazioni_ufficio
CREATE TABLE public.impostazioni_ufficio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid NOT NULL REFERENCES uffici(id),
  chiave text NOT NULL,
  valore_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ufficio_id, chiave)
);

ALTER TABLE public.impostazioni_ufficio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all impostazioni_ufficio" ON public.impostazioni_ufficio FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ufficio select own impostazioni" ON public.impostazioni_ufficio FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());
CREATE POLICY "Ufficio update own impostazioni" ON public.impostazioni_ufficio FOR UPDATE USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- Trigger updated_at
CREATE TRIGGER set_updated_at_impostazioni_sistema BEFORE UPDATE ON public.impostazioni_sistema FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_impostazioni_ufficio BEFORE UPDATE ON public.impostazioni_ufficio FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed parametri minimi
INSERT INTO public.impostazioni_sistema (chiave, valore_json, descrizione) VALUES
  ('password_default', '"Cambiami123!"'::jsonb, 'Password di default per nuovi utenti'),
  ('giorni_tolleranza_matching_banca', '5'::jsonb, 'Giorni di tolleranza per il matching bancario'),
  ('soglia_score_ok', '85'::jsonb, 'Soglia score matching OK (0-100)'),
  ('soglia_score_verifica', '60'::jsonb, 'Soglia score matching da verificare (0-100)'),
  ('limiti_upload_file_mb', '10'::jsonb, 'Limite massimo upload file in MB'),
  ('giorni_alert_eventi_sinistri', '7'::jsonb, 'Giorni prima della scadenza per alert sinistri');
