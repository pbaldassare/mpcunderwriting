-- Dettaglio portali (TED / Mondo Appalti): esito, aggiudicatario, date mandato.
-- Non confondere tipo_avviso (gara/esito) con bandi_pubblici.stato (aperto/scaduto).

ALTER TABLE public.bandi_pubblici
  ADD COLUMN IF NOT EXISTS tipo_avviso TEXT,
  ADD COLUMN IF NOT EXISTS notice_type TEXT,
  ADD COLUMN IF NOT EXISTS form_type TEXT,
  ADD COLUMN IF NOT EXISTS aggiudicato BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aggiudicatario TEXT,
  ADD COLUMN IF NOT EXISTS data_decisione DATE,
  ADD COLUMN IF NOT EXISTS data_contratto DATE,
  ADD COLUMN IF NOT EXISTS servizio_da DATE,
  ADD COLUMN IF NOT EXISTS servizio_a DATE,
  ADD COLUMN IF NOT EXISTS tipo_procedura TEXT,
  ADD COLUMN IF NOT EXISTS data_pubblicazione DATE;

ALTER TABLE public.bandi_pubblici
  DROP CONSTRAINT IF EXISTS bandi_pubblici_tipo_avviso_chk;
ALTER TABLE public.bandi_pubblici
  ADD CONSTRAINT bandi_pubblici_tipo_avviso_chk
  CHECK (tipo_avviso IS NULL OR tipo_avviso IN ('gara', 'esito', 'altro'));

COMMENT ON COLUMN public.bandi_pubblici.tipo_avviso IS
  'gara = avviso di gara; esito = aggiudicazione/CAN. Distinto da stato (aperto/scaduto).';
COMMENT ON COLUMN public.bandi_pubblici.aggiudicatario IS
  'Nome del vincitore se l''avviso è un esito TED o una scheda Mondo di aggiudicazione.';
COMMENT ON COLUMN public.bandi_pubblici.servizio_da IS
  'Inizio del servizio/mandato di brokeraggio, se indicato dal portale o dal titolo.';
COMMENT ON COLUMN public.bandi_pubblici.servizio_a IS
  'Fine del servizio/mandato di brokeraggio.';
