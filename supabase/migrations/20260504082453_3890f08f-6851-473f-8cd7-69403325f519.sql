
-- 1) Tabella master conti_bancari
CREATE TABLE public.conti_bancari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etichetta text NOT NULL,
  iban text NOT NULL,
  intestato_a text NOT NULL,
  banca text,
  bic text,
  codice_abi text,
  codice_cab text,
  citta_banca text,
  tipo text NOT NULL DEFAULT 'generico',
  is_default boolean NOT NULL DEFAULT false,
  ufficio_id uuid REFERENCES public.uffici(id) ON DELETE SET NULL,
  piano_conti_conto_id uuid REFERENCES public.piano_conti_conti(id) ON DELETE SET NULL,
  attivo boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- IBAN univoco
CREATE UNIQUE INDEX conti_bancari_iban_unique ON public.conti_bancari (iban);

-- Un solo default per tipo (solo tra attivi)
CREATE UNIQUE INDEX conti_bancari_default_per_tipo
  ON public.conti_bancari (tipo)
  WHERE is_default = true AND attivo = true;

-- 2) Trigger di normalizzazione IBAN + validazione tipo
CREATE OR REPLACE FUNCTION public.normalize_conto_bancario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Normalizza IBAN: uppercase + rimozione spazi
  IF NEW.iban IS NOT NULL THEN
    NEW.iban := UPPER(REGEXP_REPLACE(NEW.iban, '\s+', '', 'g'));
  END IF;

  -- Validazione lunghezza IBAN IT (27 char)
  IF NEW.iban LIKE 'IT%' AND LENGTH(NEW.iban) <> 27 THEN
    RAISE EXCEPTION 'IBAN italiano non valido: deve essere lungo 27 caratteri (ricevuto %).', LENGTH(NEW.iban);
  END IF;

  -- Tipo valido
  IF NEW.tipo NOT IN ('incasso_clienti','compagnia','provvigioni','generico') THEN
    RAISE EXCEPTION 'Tipo conto non valido: %', NEW.tipo;
  END IF;

  -- Audit
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_conto_bancario
  BEFORE INSERT OR UPDATE ON public.conti_bancari
  FOR EACH ROW EXECUTE FUNCTION public.normalize_conto_bancario();

-- 3) RLS
ALTER TABLE public.conti_bancari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read conti_bancari"
  ON public.conti_bancari FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Responsabile insert conti_bancari"
  ON public.conti_bancari FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede'))
  );

CREATE POLICY "Admin/Responsabile update conti_bancari"
  ON public.conti_bancari FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede'))
  );

CREATE POLICY "Admin delete conti_bancari"
  ON public.conti_bancari FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin')
  );

-- 4) Aggiunta FK opzionali alle tabelle esistenti
ALTER TABLE public.uffici
  ADD COLUMN conto_incasso_id uuid REFERENCES public.conti_bancari(id) ON DELETE SET NULL;

ALTER TABLE public.compagnie
  ADD COLUMN conto_bancario_id uuid REFERENCES public.conti_bancari(id) ON DELETE SET NULL;

ALTER TABLE public.compagnia_rapporti
  ADD COLUMN conto_bancario_id uuid REFERENCES public.conti_bancari(id) ON DELETE SET NULL;

-- 5) Seed: default storico hardcoded come default incassi clienti
INSERT INTO public.conti_bancari (etichetta, iban, intestato_a, banca, tipo, is_default, note)
VALUES (
  'Conto incassi clienti - Default',
  'IT70Q0306904214100000016469',
  'CONSULBROKERS DIGITAL SRL per conto compagnie',
  'Intesa Sanpaolo SpA',
  'incasso_clienti',
  true,
  'Default storico migrato dall''hardcoded in ECClientePdfPage'
);

-- 6) Seed: importa conti dal piano dei conti
INSERT INTO public.conti_bancari (etichetta, iban, intestato_a, banca, bic, piano_conti_conto_id, tipo, attivo)
SELECT
  pcc.descrizione,
  pcc.iban,
  COALESCE(pcc.descrizione, 'Conto contabile'),
  pcc.descrizione,
  pcc.bic,
  pcc.id,
  'generico',
  pcc.attivo
FROM public.piano_conti_conti pcc
WHERE pcc.iban IS NOT NULL
  AND TRIM(pcc.iban) <> ''
ON CONFLICT (iban) DO NOTHING;

-- 7) Seed: importa IBAN delle compagnie e collega
DO $$
DECLARE
  c RECORD;
  v_iban_norm text;
  v_id uuid;
BEGIN
  FOR c IN
    SELECT id, nome, iban, intestato_a, bic, citta_banca
    FROM public.compagnie
    WHERE iban IS NOT NULL AND TRIM(iban) <> ''
  LOOP
    v_iban_norm := UPPER(REGEXP_REPLACE(c.iban, '\s+', '', 'g'));

    -- Skip IBAN non validi italiani
    IF v_iban_norm LIKE 'IT%' AND LENGTH(v_iban_norm) <> 27 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.conti_bancari (etichetta, iban, intestato_a, bic, citta_banca, tipo, attivo)
    VALUES (
      'Compagnia: ' || c.nome,
      v_iban_norm,
      COALESCE(c.intestato_a, c.nome),
      c.bic,
      c.citta_banca,
      'compagnia',
      true
    )
    ON CONFLICT (iban) DO UPDATE SET tipo = 'compagnia'
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.conti_bancari WHERE iban = v_iban_norm;
    END IF;

    UPDATE public.compagnie SET conto_bancario_id = v_id WHERE id = c.id;
  END LOOP;
END$$;

-- 8) Seed: importa iban_dedicato dai rapporti N:N
DO $$
DECLARE
  r RECORD;
  v_iban_norm text;
  v_id uuid;
  v_compagnia_nome text;
BEGIN
  FOR r IN
    SELECT cr.id, cr.compagnia_id, cr.iban_dedicato
    FROM public.compagnia_rapporti cr
    WHERE cr.iban_dedicato IS NOT NULL AND TRIM(cr.iban_dedicato) <> ''
  LOOP
    v_iban_norm := UPPER(REGEXP_REPLACE(r.iban_dedicato, '\s+', '', 'g'));

    IF v_iban_norm LIKE 'IT%' AND LENGTH(v_iban_norm) <> 27 THEN
      CONTINUE;
    END IF;

    SELECT nome INTO v_compagnia_nome FROM public.compagnie WHERE id = r.compagnia_id;

    INSERT INTO public.conti_bancari (etichetta, iban, intestato_a, tipo, attivo)
    VALUES (
      'Rapporto dedicato: ' || COALESCE(v_compagnia_nome, '?'),
      v_iban_norm,
      COALESCE(v_compagnia_nome, 'Compagnia'),
      'compagnia',
      true
    )
    ON CONFLICT (iban) DO NOTHING;

    SELECT id INTO v_id FROM public.conti_bancari WHERE iban = v_iban_norm;
    UPDATE public.compagnia_rapporti SET conto_bancario_id = v_id WHERE id = r.id;
  END LOOP;
END$$;

-- 9) Commenti deprecazione su colonne testuali legacy
COMMENT ON COLUMN public.uffici.iban IS 'DEPRECATED: usare uffici.conto_incasso_id → conti_bancari';
COMMENT ON COLUMN public.uffici.intestato_a IS 'DEPRECATED: usare uffici.conto_incasso_id → conti_bancari';
COMMENT ON COLUMN public.uffici.banca IS 'DEPRECATED: usare uffici.conto_incasso_id → conti_bancari';
COMMENT ON COLUMN public.compagnie.iban IS 'DEPRECATED: usare compagnie.conto_bancario_id → conti_bancari';
COMMENT ON COLUMN public.compagnia_rapporti.iban_dedicato IS 'DEPRECATED: usare compagnia_rapporti.conto_bancario_id → conti_bancari';
