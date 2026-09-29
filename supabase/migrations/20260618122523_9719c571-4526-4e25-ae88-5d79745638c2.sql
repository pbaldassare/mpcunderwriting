
-- FASE 1: SEPARAZIONE POLIZZA <-> QUIETANZA

DO $$ BEGIN
  CREATE TYPE public.polizza_stato AS ENUM ('attiva','sospesa','annullata','scaduta','sostituita');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quietanza_stato AS ENUM ('da_incassare','incassato','sospesa','annullata','stornata');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) TABELLA polizze
CREATE TABLE IF NOT EXISTS public.polizze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_polizza text,
  numero_polizza_precedente text,
  cig_rif text,
  appendice_corrente text,
  cliente_anagrafica_id uuid REFERENCES public.clienti(id) ON DELETE RESTRICT,
  compagnia_id uuid REFERENCES public.compagnie(id),
  compagnia_rapporto_id uuid REFERENCES public.compagnia_rapporti(id),
  ramo_id uuid REFERENCES public.rami(id),
  gruppo_ramo_id uuid REFERENCES public.gruppi_ramo(id),
  prodotto_nome text,
  tipo_mandatario text,
  risk_type text,
  ufficio_id uuid REFERENCES public.uffici(id),
  account_executive_anagrafica_id uuid REFERENCES public.anagrafiche_professionali(id),
  produttore_anagrafica_id uuid REFERENCES public.anagrafiche_professionali(id),
  anagrafica_commerciale_id uuid REFERENCES public.anagrafiche_professionali(id),
  commerciale_id uuid,
  percentuale_commerciale numeric,
  percentuale_riparto numeric,
  durata_da date,
  durata_a date,
  anni_durata integer,
  frazionamento text,
  tacito_rinnovo boolean DEFAULT false,
  disdetta_mesi integer,
  tipo_scadenza text,
  giorni_presentazione integer,
  regolazione boolean DEFAULT false,
  tipo_lettera_regolazione text,
  indicizzata boolean DEFAULT false,
  libro_matricola text,
  premio_annuo_lordo numeric DEFAULT 0,
  premio_annuo_netto numeric DEFAULT 0,
  tasse_annue numeric DEFAULT 0,
  addizionali_annue numeric DEFAULT 0,
  ssn_annuo numeric DEFAULT 0,
  provvigioni_annue_firma numeric DEFAULT 0,
  provvigioni_annue_quietanza numeric DEFAULT 0,
  no_calcolo_tasse boolean DEFAULT false,
  valuta text DEFAULT 'EUR',
  cambio numeric DEFAULT 1,
  targa_telaio text,
  pag_diretto_compagnia boolean DEFAULT false,
  emissione_fee boolean DEFAULT false,
  formato_elettronico boolean DEFAULT false,
  vincolo text,
  stato public.polizza_stato NOT NULL DEFAULT 'attiva',
  data_sospensione date,
  data_riattivazione date,
  data_annullamento date,
  motivo_annullamento text,
  sostituisce_polizza_id uuid REFERENCES public.polizze(id),
  sostituita_da_polizza_id uuid REFERENCES public.polizze(id),
  descrizione_polizza text,
  note text,
  tipo_portafoglio text,
  titolo_madre_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  search_vector tsvector
);

CREATE INDEX IF NOT EXISTS idx_polizze_cliente ON public.polizze(cliente_anagrafica_id);
CREATE INDEX IF NOT EXISTS idx_polizze_compagnia ON public.polizze(compagnia_id);
CREATE INDEX IF NOT EXISTS idx_polizze_ufficio ON public.polizze(ufficio_id);
CREATE INDEX IF NOT EXISTS idx_polizze_numero ON public.polizze(numero_polizza);
CREATE INDEX IF NOT EXISTS idx_polizze_stato_scadenza ON public.polizze(stato, durata_a);
CREATE INDEX IF NOT EXISTS idx_polizze_titolo_madre ON public.polizze(titolo_madre_id);
CREATE INDEX IF NOT EXISTS idx_polizze_search ON public.polizze USING gin(search_vector);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizze TO authenticated;
GRANT ALL ON public.polizze TO service_role;
ALTER TABLE public.polizze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all polizze" ON public.polizze FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "CFO select polizze" ON public.polizze FOR SELECT
  USING (public.has_role(auth.uid(),'cfo'));
CREATE POLICY "Sede scope polizze" ON public.polizze FOR ALL TO authenticated
  USING (public.is_global_viewer() OR (ufficio_id = ANY (public.get_my_ufficio_ids())))
  WITH CHECK (public.is_global_viewer() OR (ufficio_id = ANY (public.get_my_ufficio_ids())));
CREATE POLICY "Cliente select own polizze" ON public.polizze FOR SELECT TO authenticated
  USING (cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids()));

-- 3) TABELLA quietanze
CREATE TABLE IF NOT EXISTS public.quietanze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_id uuid NOT NULL REFERENCES public.polizze(id) ON DELETE RESTRICT,
  numero_rata integer NOT NULL,
  numero_rate_totali integer NOT NULL,
  garanzia_da date,
  garanzia_a date,
  data_competenza date,
  data_scadenza date,
  mora_giorni integer,
  limite_mora date,
  premio_lordo numeric DEFAULT 0,
  premio_netto numeric DEFAULT 0,
  tasse numeric DEFAULT 0,
  addizionali numeric DEFAULT 0,
  ssn numeric DEFAULT 0,
  provvigioni_firma numeric DEFAULT 0,
  provvigioni_quietanza numeric DEFAULT 0,
  stato public.quietanza_stato NOT NULL DEFAULT 'da_incassare',
  data_messa_cassa date,
  data_pagamento date,
  data_incasso date,
  importo_incassato numeric,
  tipo_incasso text,
  conto_incasso text,
  appendice text,
  numero_polizza_snapshot text,
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector,
  CONSTRAINT uq_quietanze_polizza_rata UNIQUE (polizza_id, numero_rata)
);

CREATE INDEX IF NOT EXISTS idx_quietanze_polizza ON public.quietanze(polizza_id);
CREATE INDEX IF NOT EXISTS idx_quietanze_stato_scad ON public.quietanze(stato, data_scadenza);
CREATE INDEX IF NOT EXISTS idx_quietanze_messa_cassa ON public.quietanze(data_messa_cassa);
CREATE INDEX IF NOT EXISTS idx_quietanze_garanzia ON public.quietanze(garanzia_da, garanzia_a);
CREATE INDEX IF NOT EXISTS idx_quietanze_titolo ON public.quietanze(titolo_id);
CREATE INDEX IF NOT EXISTS idx_quietanze_search ON public.quietanze USING gin(search_vector);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quietanze TO authenticated;
GRANT ALL ON public.quietanze TO service_role;
ALTER TABLE public.quietanze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all quietanze" ON public.quietanze FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "CFO select quietanze" ON public.quietanze FOR SELECT
  USING (public.has_role(auth.uid(),'cfo'));
CREATE POLICY "Sede scope quietanze" ON public.quietanze FOR ALL TO authenticated
  USING (public.is_global_viewer()
    OR EXISTS (SELECT 1 FROM public.polizze p WHERE p.id = polizza_id
               AND (p.ufficio_id = ANY (public.get_my_ufficio_ids()))))
  WITH CHECK (public.is_global_viewer()
    OR EXISTS (SELECT 1 FROM public.polizze p WHERE p.id = polizza_id
               AND (p.ufficio_id = ANY (public.get_my_ufficio_ids()))));
CREATE POLICY "Cliente select own quietanze" ON public.quietanze FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polizze p
    WHERE p.id = polizza_id
      AND p.cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids())));

-- 4) FK opzionali su tabelle esistenti
ALTER TABLE public.titoli                 ADD COLUMN IF NOT EXISTS polizza_id   uuid REFERENCES public.polizze(id)   ON DELETE SET NULL;
ALTER TABLE public.premi_garanzia_polizza ADD COLUMN IF NOT EXISTS polizza_id   uuid REFERENCES public.polizze(id)   ON DELETE CASCADE;
ALTER TABLE public.premi_garanzia_polizza ADD COLUMN IF NOT EXISTS quietanza_id uuid REFERENCES public.quietanze(id) ON DELETE CASCADE;
ALTER TABLE public.appendici_polizza      ADD COLUMN IF NOT EXISTS polizza_id   uuid REFERENCES public.polizze(id)   ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_titoli_polizza_id ON public.titoli(polizza_id);
CREATE INDEX IF NOT EXISTS idx_pgp_polizza_id ON public.premi_garanzia_polizza(polizza_id);
CREATE INDEX IF NOT EXISTS idx_pgp_quietanza_id ON public.premi_garanzia_polizza(quietanza_id);
CREATE INDEX IF NOT EXISTS idx_app_polizza_id ON public.appendici_polizza(polizza_id);

-- 5) updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_set_updated_at_pq()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_polizze_updated_at ON public.polizze;
CREATE TRIGGER trg_polizze_updated_at BEFORE UPDATE ON public.polizze
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_pq();

DROP TRIGGER IF EXISTS trg_quietanze_updated_at ON public.quietanze;
CREATE TRIGGER trg_quietanze_updated_at BEFORE UPDATE ON public.quietanze
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_pq();

-- 6) RPC: numero rate per frazionamento
CREATE OR REPLACE FUNCTION public.fn_rate_per_anno(frazionamento text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(frazionamento,'annuale'))
    WHEN 'mensile' THEN 12
    WHEN 'bimestrale' THEN 6
    WHEN 'trimestrale' THEN 4
    WHEN 'quadrimestrale' THEN 3
    WHEN 'semestrale' THEN 2
    WHEN 'annuale' THEN 1
    WHEN 'poliennale' THEN 1
    ELSE 1
  END
$$;

-- 7) RPC: genera quietanze
CREATE OR REPLACE FUNCTION public.fn_polizza_genera_quietanze(_polizza_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  rate_anno integer;
  mesi_per_rata integer;
  mesi_totali integer;
  n_rate integer;
  i integer;
  rata_da date;
  rata_a date;
  inserted integer := 0;
  imp_lordo numeric; imp_netto numeric; imp_tasse numeric; imp_addiz numeric; imp_ssn numeric;
  imp_provf numeric; imp_provq numeric;
BEGIN
  SELECT * INTO p FROM public.polizze WHERE id = _polizza_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF p.durata_da IS NULL OR p.durata_a IS NULL THEN RETURN 0; END IF;

  rate_anno := public.fn_rate_per_anno(p.frazionamento);
  mesi_totali := GREATEST(1, ((EXTRACT(YEAR FROM age(p.durata_a, p.durata_da))*12)
                            + EXTRACT(MONTH FROM age(p.durata_a, p.durata_da)))::int + 1);
  IF lower(coalesce(p.frazionamento,'annuale')) = 'poliennale' THEN
    n_rate := 1;
  ELSE
    mesi_per_rata := GREATEST(1, 12 / rate_anno);
    n_rate := GREATEST(1, mesi_totali / mesi_per_rata);
  END IF;

  IF lower(coalesce(p.frazionamento,'annuale')) = 'poliennale' THEN
    imp_lordo := coalesce(p.premio_annuo_lordo,0);
    imp_netto := coalesce(p.premio_annuo_netto,0);
    imp_tasse := coalesce(p.tasse_annue,0);
    imp_addiz := coalesce(p.addizionali_annue,0);
    imp_ssn   := coalesce(p.ssn_annuo,0);
    imp_provf := coalesce(p.provvigioni_annue_firma,0);
    imp_provq := coalesce(p.provvigioni_annue_quietanza,0);
  ELSE
    imp_lordo := round(coalesce(p.premio_annuo_lordo,0) * mesi_per_rata::numeric / 12.0, 2);
    imp_netto := round(coalesce(p.premio_annuo_netto,0) * mesi_per_rata::numeric / 12.0, 2);
    imp_tasse := round(coalesce(p.tasse_annue,0)        * mesi_per_rata::numeric / 12.0, 2);
    imp_addiz := round(coalesce(p.addizionali_annue,0)  * mesi_per_rata::numeric / 12.0, 2);
    imp_ssn   := round(coalesce(p.ssn_annuo,0)          * mesi_per_rata::numeric / 12.0, 2);
    imp_provf := round(coalesce(p.provvigioni_annue_firma,0)     * mesi_per_rata::numeric / 12.0, 2);
    imp_provq := round(coalesce(p.provvigioni_annue_quietanza,0) * mesi_per_rata::numeric / 12.0, 2);
  END IF;

  FOR i IN 1..n_rate LOOP
    IF lower(coalesce(p.frazionamento,'annuale')) = 'poliennale' THEN
      rata_da := p.durata_da;
      rata_a  := p.durata_a;
    ELSE
      rata_da := (p.durata_da + ((i-1)*mesi_per_rata) * interval '1 month')::date;
      rata_a  := ((p.durata_da + (i*mesi_per_rata) * interval '1 month') - interval '1 day')::date;
      IF rata_a > p.durata_a THEN rata_a := p.durata_a; END IF;
    END IF;

    INSERT INTO public.quietanze(
      polizza_id, numero_rata, numero_rate_totali,
      garanzia_da, garanzia_a, data_competenza, data_scadenza,
      premio_lordo, premio_netto, tasse, addizionali, ssn,
      provvigioni_firma, provvigioni_quietanza,
      stato, numero_polizza_snapshot
    ) VALUES (
      _polizza_id, i, n_rate,
      rata_da, rata_a, rata_da, rata_a,
      imp_lordo, imp_netto, imp_tasse, imp_addiz, imp_ssn,
      imp_provf, imp_provq,
      'da_incassare', p.numero_polizza
    )
    ON CONFLICT (polizza_id, numero_rata) DO NOTHING;
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END $$;

-- 8) Trigger after INSERT polizza -> genera quietanze
CREATE OR REPLACE FUNCTION public.tg_polizza_after_insert_genera_quietanze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.quietanze WHERE polizza_id = NEW.id) THEN RETURN NEW; END IF;
  IF current_setting('app.skip_genera_quietanze', true) = 'on' THEN RETURN NEW; END IF;
  PERFORM public.fn_polizza_genera_quietanze(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_polizza_after_insert ON public.polizze;
CREATE TRIGGER trg_polizza_after_insert
  AFTER INSERT ON public.polizze
  FOR EACH ROW EXECUTE FUNCTION public.tg_polizza_after_insert_genera_quietanze();

-- 9) Sync legacy: quando si crea Quietanza nuova senza titolo_id, crea titolo legacy
CREATE OR REPLACE FUNCTION public.tg_quietanza_sync_to_titoli()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  nuovo_titolo_id uuid;
BEGIN
  IF NEW.titolo_id IS NOT NULL THEN RETURN NEW; END IF;
  IF current_setting('app.skip_legacy_sync', true) = 'on' THEN RETURN NEW; END IF;

  SELECT * INTO p FROM public.polizze WHERE id = NEW.polizza_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.titoli(
    numero_titolo, cliente_anagrafica_id, ufficio_id,
    compagnia_id, ramo_id, prodotto_nome, descrizione_polizza,
    stato, periodicita, tipo_portafoglio, tipo_mandatario, risk_type,
    durata_da, durata_a, anni_durata,
    garanzia_da, garanzia_a, data_competenza, data_scadenza,
    mora_giorni, limite_mora,
    premio_lordo, premio_netto, tasse, addizionali,
    provvigioni_firma, provvigioni_quietanza,
    targa_telaio, polizza_id, tacito_rinnovo
  ) VALUES (
    p.numero_polizza, p.cliente_anagrafica_id, p.ufficio_id,
    p.compagnia_id, p.ramo_id, p.prodotto_nome, p.descrizione_polizza,
    'attivo', p.frazionamento, p.tipo_portafoglio, p.tipo_mandatario, p.risk_type,
    p.durata_da, p.durata_a, p.anni_durata,
    NEW.garanzia_da, NEW.garanzia_a, NEW.data_competenza, NEW.data_scadenza,
    NEW.mora_giorni, NEW.limite_mora,
    NEW.premio_lordo, NEW.premio_netto, NEW.tasse, NEW.addizionali,
    NEW.provvigioni_firma, NEW.provvigioni_quietanza,
    p.targa_telaio, p.id, p.tacito_rinnovo
  ) RETURNING id INTO nuovo_titolo_id;

  UPDATE public.quietanze SET titolo_id = nuovo_titolo_id WHERE id = NEW.id;
  IF NEW.numero_rata = 1 THEN
    UPDATE public.polizze SET titolo_madre_id = nuovo_titolo_id WHERE id = p.id AND titolo_madre_id IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quietanza_sync_titoli ON public.quietanze;
CREATE TRIGGER trg_quietanza_sync_titoli
  AFTER INSERT ON public.quietanze
  FOR EACH ROW EXECUTE FUNCTION public.tg_quietanza_sync_to_titoli();

-- 10) BACKFILL retroattivo
DO $backfill$
DECLARE
  v_count_pre integer; v_count_post integer;
  v_sum_premio_pre numeric; v_sum_premio_post numeric;
  v_sum_provv_pre numeric; v_sum_provv_post numeric;
  v_count_incassati_pre integer; v_count_incassati_post integer;
  v_polizze_create integer := 0;
  v_quietanze_create integer := 0;
  catena RECORD; rec RECORD;
  v_polizza_id uuid; v_numero_rata integer; v_n_rate integer;
  v_numero_titolo text;
BEGIN
  PERFORM set_config('app.skip_legacy_sync','on',true);
  PERFORM set_config('app.skip_genera_quietanze','on',true);

  SELECT COUNT(*), coalesce(SUM(premio_lordo),0),
         coalesce(SUM(coalesce(provvigioni_firma,0)+coalesce(provvigioni_quietanza,0)),0),
         COUNT(*) FILTER (WHERE data_messa_cassa IS NOT NULL)
    INTO v_count_pre, v_sum_premio_pre, v_sum_provv_pre, v_count_incassati_pre
  FROM public.titoli;

  -- Catene regolari: 1 madre + N rate
  FOR catena IN
    SELECT t.numero_titolo
    FROM public.titoli t
    WHERE t.numero_titolo IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.quietanze q WHERE q.titolo_id = t.id)
    GROUP BY t.numero_titolo
    HAVING COUNT(*) FILTER (WHERE t.sostituisce_polizza IS NULL) = 1
  LOOP
    v_numero_titolo := catena.numero_titolo;

    INSERT INTO public.polizze (
      numero_polizza, cliente_anagrafica_id, ufficio_id,
      compagnia_id, ramo_id, prodotto_nome, descrizione_polizza,
      frazionamento, tipo_portafoglio, tipo_mandatario, risk_type,
      durata_da, durata_a, anni_durata, tacito_rinnovo,
      premio_annuo_lordo, premio_annuo_netto, tasse_annue, addizionali_annue,
      provvigioni_annue_firma, provvigioni_annue_quietanza,
      targa_telaio, cig_rif, vincolo,
      stato, titolo_madre_id, created_at
    )
    SELECT
      t.numero_titolo, t.cliente_anagrafica_id, t.ufficio_id,
      t.compagnia_id, t.ramo_id, t.prodotto_nome, t.descrizione_polizza,
      t.periodicita, t.tipo_portafoglio, t.tipo_mandatario, t.risk_type,
      t.durata_da, t.durata_a, t.anni_durata, coalesce(t.tacito_rinnovo,false),
      coalesce(t.premio_lordo,0), coalesce(t.premio_netto,0), coalesce(t.tasse,0), coalesce(t.addizionali,0),
      coalesce(t.provvigioni_firma,0), coalesce(t.provvigioni_quietanza,0),
      t.targa_telaio, t.cig_rif, t.vincolo,
      CASE t.stato WHEN 'sospeso' THEN 'sospesa'::polizza_stato
                   WHEN 'annullato' THEN 'annullata'::polizza_stato
                   ELSE 'attiva'::polizza_stato END,
      t.id, coalesce(t.created_at, now())
    FROM public.titoli t
    WHERE t.numero_titolo = v_numero_titolo
      AND t.sostituisce_polizza IS NULL
    LIMIT 1
    RETURNING id INTO v_polizza_id;

    v_polizze_create := v_polizze_create + 1;

    v_numero_rata := 0;
    SELECT COUNT(*) INTO v_n_rate FROM public.titoli WHERE numero_titolo = v_numero_titolo;

    FOR rec IN
      SELECT t.*
      FROM public.titoli t
      WHERE t.numero_titolo = v_numero_titolo
      ORDER BY (t.sostituisce_polizza IS NOT NULL), t.garanzia_da NULLS LAST, t.created_at NULLS LAST
    LOOP
      v_numero_rata := v_numero_rata + 1;
      INSERT INTO public.quietanze (
        polizza_id, numero_rata, numero_rate_totali,
        garanzia_da, garanzia_a, data_competenza, data_scadenza,
        mora_giorni, limite_mora,
        premio_lordo, premio_netto, tasse, addizionali,
        provvigioni_firma, provvigioni_quietanza,
        stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
        tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
        titolo_id, created_at
      ) VALUES (
        v_polizza_id, v_numero_rata, v_n_rate,
        rec.garanzia_da, rec.garanzia_a, rec.data_competenza, rec.data_scadenza,
        rec.mora_giorni, rec.limite_mora,
        coalesce(rec.premio_lordo,0), coalesce(rec.premio_netto,0), coalesce(rec.tasse,0), coalesce(rec.addizionali,0),
        coalesce(rec.provvigioni_firma,0), coalesce(rec.provvigioni_quietanza,0),
        CASE WHEN rec.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
             WHEN rec.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
             WHEN rec.stato = 'annullato' THEN 'annullata'::quietanza_stato
             ELSE 'da_incassare'::quietanza_stato END,
        rec.data_messa_cassa, rec.data_pagamento, rec.data_incasso, rec.importo_incassato,
        rec.tipo_incasso, rec.conto_incasso, rec.appendice, rec.numero_titolo,
        rec.id, coalesce(rec.created_at, now())
      )
      ON CONFLICT (polizza_id, numero_rata) DO NOTHING;
      v_quietanze_create := v_quietanze_create + 1;

      UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = rec.id AND polizza_id IS NULL;
    END LOOP;
  END LOOP;

  -- Titoli rimasti (catene anomale multi-madre o senza numero): 1 polizza + 1 quietanza per titolo
  FOR rec IN
    SELECT t.* FROM public.titoli t
    WHERE t.polizza_id IS NULL
  LOOP
    INSERT INTO public.polizze (
      numero_polizza, cliente_anagrafica_id, ufficio_id,
      compagnia_id, ramo_id, prodotto_nome, descrizione_polizza,
      frazionamento, tipo_portafoglio,
      durata_da, durata_a, anni_durata,
      premio_annuo_lordo, premio_annuo_netto, tasse_annue, addizionali_annue,
      provvigioni_annue_firma, provvigioni_annue_quietanza,
      targa_telaio, cig_rif,
      stato, titolo_madre_id, created_at
    ) VALUES (
      coalesce(rec.numero_titolo,'AUTO-'||substr(rec.id::text,1,8)) || '#' || substr(rec.id::text,1,8),
      rec.cliente_anagrafica_id, rec.ufficio_id,
      rec.compagnia_id, rec.ramo_id, rec.prodotto_nome, rec.descrizione_polizza,
      rec.periodicita, rec.tipo_portafoglio,
      rec.durata_da, rec.durata_a, rec.anni_durata,
      coalesce(rec.premio_lordo,0), coalesce(rec.premio_netto,0), coalesce(rec.tasse,0), coalesce(rec.addizionali,0),
      coalesce(rec.provvigioni_firma,0), coalesce(rec.provvigioni_quietanza,0),
      rec.targa_telaio, rec.cig_rif,
      CASE rec.stato WHEN 'sospeso' THEN 'sospesa'::polizza_stato
                     WHEN 'annullato' THEN 'annullata'::polizza_stato
                     ELSE 'attiva'::polizza_stato END,
      rec.id, coalesce(rec.created_at, now())
    ) RETURNING id INTO v_polizza_id;
    v_polizze_create := v_polizze_create + 1;

    INSERT INTO public.quietanze (
      polizza_id, numero_rata, numero_rate_totali,
      garanzia_da, garanzia_a, data_competenza, data_scadenza,
      mora_giorni, limite_mora,
      premio_lordo, premio_netto, tasse, addizionali,
      provvigioni_firma, provvigioni_quietanza,
      stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
      tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
      titolo_id, created_at
    ) VALUES (
      v_polizza_id, 1, 1,
      rec.garanzia_da, rec.garanzia_a, rec.data_competenza, rec.data_scadenza,
      rec.mora_giorni, rec.limite_mora,
      coalesce(rec.premio_lordo,0), coalesce(rec.premio_netto,0), coalesce(rec.tasse,0), coalesce(rec.addizionali,0),
      coalesce(rec.provvigioni_firma,0), coalesce(rec.provvigioni_quietanza,0),
      CASE WHEN rec.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
           WHEN rec.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
           ELSE 'da_incassare'::quietanza_stato END,
      rec.data_messa_cassa, rec.data_pagamento, rec.data_incasso, rec.importo_incassato,
      rec.tipo_incasso, rec.conto_incasso, rec.appendice, rec.numero_titolo,
      rec.id, coalesce(rec.created_at, now())
    );
    v_quietanze_create := v_quietanze_create + 1;

    UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = rec.id;
  END LOOP;

  SELECT COUNT(*), coalesce(SUM(premio_lordo),0),
         coalesce(SUM(coalesce(provvigioni_firma,0)+coalesce(provvigioni_quietanza,0)),0),
         COUNT(*) FILTER (WHERE data_messa_cassa IS NOT NULL)
    INTO v_count_post, v_sum_premio_post, v_sum_provv_post, v_count_incassati_post
  FROM public.quietanze;

  RAISE NOTICE 'Backfill: % polizze, % quietanze', v_polizze_create, v_quietanze_create;
  RAISE NOTICE 'Pre  titoli:    count=% premio=% provv=% incassati=%', v_count_pre, v_sum_premio_pre, v_sum_provv_pre, v_count_incassati_pre;
  RAISE NOTICE 'Post quietanze: count=% premio=% provv=% incassati=%', v_count_post, v_sum_premio_post, v_sum_provv_post, v_count_incassati_post;

  IF v_count_pre <> v_count_post THEN
    RAISE EXCEPTION 'Backfill KO: count titoli=% vs quietanze=%', v_count_pre, v_count_post;
  END IF;
  IF round(v_sum_premio_pre,2) <> round(v_sum_premio_post,2) THEN
    RAISE EXCEPTION 'Backfill KO: somma premio: titoli=% vs quietanze=%', v_sum_premio_pre, v_sum_premio_post;
  END IF;
  IF round(v_sum_provv_pre,2) <> round(v_sum_provv_post,2) THEN
    RAISE EXCEPTION 'Backfill KO: somma provv: titoli=% vs quietanze=%', v_sum_provv_pre, v_sum_provv_post;
  END IF;
  IF v_count_incassati_pre <> v_count_incassati_post THEN
    RAISE EXCEPTION 'Backfill KO: incassati: titoli=% vs quietanze=%', v_count_incassati_pre, v_count_incassati_post;
  END IF;
END $backfill$;

COMMENT ON TABLE public.polizze IS 'Contratto assicurativo (non si mette mai a cassa). Una polizza ha N quietanze.';
COMMENT ON TABLE public.quietanze IS 'Rata pagabile della polizza. Tutto cio che e messa a cassa/rimessa/EC.';
