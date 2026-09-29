-- =========================================
-- STORICO GARE (Market Intelligence)
-- =========================================

CREATE TABLE public.storico_gare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Categorici (filtri principali)
  anno_riferimento int NOT NULL,
  ente_nome text NOT NULL,
  provincia text,
  tipologia text, -- 'manifestazione' | 'gara' | 'affidamento_diretto' | 'altro'
  esito text,     -- 'vinta' | 'persa' | 'non_partecipato' | 'annullata' | 'in_corso' | 'non_classificato'
  broker_incumbent text,
  categoria_ente text, -- derivato: 'comune' | 'provincia' | 'regione' | 'azienda_sanitaria' | 'universita' | 'consorzio' | 'societa_partecipata' | 'altro_ente'
  
  -- Date
  data_consegna date,
  data_inizio_mandato date,
  data_fine_mandato date,
  
  -- Rinnovo
  opzione_rinnovo text,        -- testo libero originale
  opzione_rinnovo_anni int,    -- derivato regex
  
  -- Flag requisiti
  flag_cauzione boolean,
  flag_referenze_bancarie boolean,
  flag_accesso_atti boolean,
  flag_offerta_tecnica boolean,
  pagine_offerta_tecnica text,
  
  -- Testo libero
  note text,
  contatto_riferimento text,
  contatto_telefono text,
  
  -- Link
  trattativa_id uuid REFERENCES public.trattative(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  
  -- Audit / sorgente
  source_file text DEFAULT 'ELENCO_GARE_GENERALE_1.xlsx',
  source_sheet text,
  source_row int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indici per filtri server-side
CREATE INDEX idx_storico_gare_anno ON public.storico_gare(anno_riferimento);
CREATE INDEX idx_storico_gare_ente_nome ON public.storico_gare(ente_nome);
CREATE INDEX idx_storico_gare_provincia ON public.storico_gare(provincia);
CREATE INDEX idx_storico_gare_tipologia ON public.storico_gare(tipologia);
CREATE INDEX idx_storico_gare_esito ON public.storico_gare(esito);
CREATE INDEX idx_storico_gare_broker ON public.storico_gare(broker_incumbent);
CREATE INDEX idx_storico_gare_categoria ON public.storico_gare(categoria_ente);
CREATE INDEX idx_storico_gare_data_fine ON public.storico_gare(data_fine_mandato);
CREATE INDEX idx_storico_gare_cliente ON public.storico_gare(cliente_id);
CREATE INDEX idx_storico_gare_trattativa ON public.storico_gare(trattativa_id);

-- =========================================
-- TRIGGER: validazione enum + normalizzazioni + derivazioni
-- =========================================

CREATE OR REPLACE FUNCTION public.storico_gare_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name_upper text;
BEGIN
  -- Normalizza ente_nome
  IF NEW.ente_nome IS NOT NULL THEN
    NEW.ente_nome := UPPER(TRIM(REGEXP_REPLACE(NEW.ente_nome, '\s+', ' ', 'g')));
  END IF;
  v_name_upper := COALESCE(NEW.ente_nome, '');

  -- Normalizza broker_incumbent
  IF NEW.broker_incumbent IS NOT NULL THEN
    NEW.broker_incumbent := UPPER(TRIM(NEW.broker_incumbent));
    -- Mapping varianti note
    IF NEW.broker_incumbent IN ('B&S','B & S','B&S ITALIA','BS ITALIA') THEN
      NEW.broker_incumbent := 'B&S ITALIA';
    ELSIF NEW.broker_incumbent IN ('WILLS','WTW','WILLIS','WILLIS TOWERS WATSON') THEN
      NEW.broker_incumbent := 'WILLIS';
    ELSIF NEW.broker_incumbent IN ('MAG JLT','MAG','JLT') THEN
      NEW.broker_incumbent := 'MAG JLT';
    END IF;
  END IF;

  -- Provincia: solo 2 lettere uppercase
  IF NEW.provincia IS NOT NULL THEN
    NEW.provincia := UPPER(TRIM(NEW.provincia));
    IF LENGTH(NEW.provincia) > 2 THEN
      NEW.provincia := SUBSTRING(NEW.provincia FROM 1 FOR 2);
    END IF;
  END IF;

  -- Tipologia
  IF NEW.tipologia IS NOT NULL THEN
    NEW.tipologia := LOWER(TRIM(NEW.tipologia));
    IF NEW.tipologia NOT IN ('manifestazione','gara','affidamento_diretto','altro') THEN
      NEW.tipologia := 'altro';
    END IF;
  END IF;

  -- Esito
  IF NEW.esito IS NOT NULL THEN
    NEW.esito := LOWER(TRIM(NEW.esito));
    IF NEW.esito NOT IN ('vinta','persa','non_partecipato','annullata','in_corso','non_classificato') THEN
      NEW.esito := 'non_classificato';
    END IF;
  END IF;

  -- Deriva categoria_ente dal nome
  IF NEW.categoria_ente IS NULL AND v_name_upper <> '' THEN
    NEW.categoria_ente := CASE
      WHEN v_name_upper ~ '^COMUNE\s|^COMUNE DI' THEN 'comune'
      WHEN v_name_upper ~ '^PROVINCIA\s|^PROVINCIA DI' THEN 'provincia'
      WHEN v_name_upper ~ '^REGIONE\s' THEN 'regione'
      WHEN v_name_upper ~ 'A\.?S\.?L\.?|AZIENDA SANITARIA|AZIENDA OSPEDALIER|U\.?L\.?S\.?S\.?|A\.?O\.?U\.?' THEN 'azienda_sanitaria'
      WHEN v_name_upper ~ 'UNIVERSIT' THEN 'universita'
      WHEN v_name_upper ~ 'CONSORZIO' THEN 'consorzio'
      WHEN v_name_upper ~ 'S\.P\.A\.|SPA|S\.R\.L\.|SRL|SOCIET' THEN 'societa_partecipata'
      ELSE 'altro_ente'
    END;
  END IF;

  -- Deriva opzione_rinnovo_anni da testo libero
  IF NEW.opzione_rinnovo_anni IS NULL AND NEW.opzione_rinnovo IS NOT NULL THEN
    NEW.opzione_rinnovo_anni := COALESCE(
      NULLIF(SUBSTRING(NEW.opzione_rinnovo FROM '[+]?\s*(\d+)\s*[Aa][Nn][Nn]'), '')::int,
      0
    );
  END IF;

  -- updated_at
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_storico_gare_normalize
BEFORE INSERT OR UPDATE ON public.storico_gare
FOR EACH ROW EXECUTE FUNCTION public.storico_gare_normalize();

-- =========================================
-- VISTA: stato_mandato calcolato dinamicamente
-- =========================================

CREATE OR REPLACE VIEW public.v_storico_gare AS
SELECT
  sg.*,
  CASE
    WHEN sg.data_fine_mandato IS NULL THEN 'sconosciuto'
    WHEN sg.data_fine_mandato < CURRENT_DATE THEN 'scaduto'
    WHEN sg.data_fine_mandato <= CURRENT_DATE + INTERVAL '12 months' THEN 'in_scadenza_12m'
    ELSE 'attivo'
  END AS stato_mandato,
  c.ragione_sociale AS cliente_ragione_sociale,
  COALESCE(c.cognome || ' ' || c.nome, c.ragione_sociale) AS cliente_display
FROM public.storico_gare sg
LEFT JOIN public.clienti c ON c.id = sg.cliente_id;

-- =========================================
-- RLS
-- =========================================

ALTER TABLE public.storico_gare ENABLE ROW LEVEL SECURITY;

-- Lettura: tutti i ruoli interni (no clienti, no prospect)
CREATE POLICY "Storico gare leggibile da staff interno"
ON public.storico_gare FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin','cfo','responsabile_sede','ufficio','backoffice','account_executive','specialist','produttore','executive')
  )
);

-- INSERT/UPDATE/DELETE: solo admin e responsabile_sede
CREATE POLICY "Storico gare insert admin/responsabile"
ON public.storico_gare FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')
  )
);

CREATE POLICY "Storico gare update admin/responsabile"
ON public.storico_gare FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')
  )
);

CREATE POLICY "Storico gare delete admin/responsabile"
ON public.storico_gare FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')
  )
);