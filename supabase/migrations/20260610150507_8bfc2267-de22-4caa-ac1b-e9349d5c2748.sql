
-- 1. Estendi causali_contabili con segno_default (+ riduce dovuto / - aumenta dovuto)
ALTER TABLE public.causali_contabili
  ADD COLUMN IF NOT EXISTS segno_default text CHECK (segno_default IN ('+','-'));

-- 2. Seed causali per compensazione messa a cassa
INSERT INTO public.causali_contabili (tipo_tabella, codice, descrizione, attivo, segno_default) VALUES
  ('compensazione_messa_cassa', 'ABB_ATT', 'Abbuono attivo (riduce dovuto cliente)', true, '+'),
  ('compensazione_messa_cassa', 'ABB_PAS', 'Abbuono passivo (aumenta dovuto cliente)', true, '-'),
  ('compensazione_messa_cassa', 'SCONTO',  'Sconto commerciale',                       true, '+'),
  ('compensazione_messa_cassa', 'ARROT_A', 'Arrotondamento attivo',                    true, '+'),
  ('compensazione_messa_cassa', 'ARROT_P', 'Arrotondamento passivo',                   true, '-'),
  ('compensazione_messa_cassa', 'SPESE',   'Spese accessorie',                         true, '-')
ON CONFLICT DO NOTHING;

-- 3. Nuova tabella titoli_compensazioni
CREATE TABLE IF NOT EXISTS public.titoli_compensazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  causale_id uuid NOT NULL REFERENCES public.causali_contabili(id),
  causale_codice text NOT NULL,
  causale_descrizione text NOT NULL,
  importo numeric(12,2) NOT NULL CHECK (importo > 0),
  segno text NOT NULL CHECK (segno IN ('+','-')),
  note text,
  creato_da uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_titoli_compensazioni_titolo ON public.titoli_compensazioni(titolo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titoli_compensazioni TO authenticated;
GRANT ALL ON public.titoli_compensazioni TO service_role;

ALTER TABLE public.titoli_compensazioni ENABLE ROW LEVEL SECURITY;

-- Policy: staff (admin/cfo/ufficio/backoffice/contabilita/manager) FULL
CREATE POLICY "staff full on titoli_compensazioni"
ON public.titoli_compensazioni
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin','cfo','ufficio','backoffice','contabilita','manager')
  )
);

-- Policy: cliente read-only sui propri titoli (via get_my_cliente_ids)
CREATE POLICY "cliente read own titoli_compensazioni"
ON public.titoli_compensazioni
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.titoli t
    JOIN public.clienti c ON c.id = t.cliente_anagrafica_id
    WHERE t.id = titoli_compensazioni.titolo_id
      AND c.user_id = auth.uid()
  )
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_titoli_compensazioni_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_compensazioni_updated_at ON public.titoli_compensazioni;
CREATE TRIGGER trg_titoli_compensazioni_updated_at
BEFORE UPDATE ON public.titoli_compensazioni
FOR EACH ROW EXECUTE FUNCTION public.tg_titoli_compensazioni_updated_at();
