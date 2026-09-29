
-- ============================================
-- 1) TABELLA anomalie_sistema
-- ============================================
CREATE TABLE public.anomalie_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  entita_tipo text NOT NULL,
  entita_id uuid NOT NULL,
  ufficio_id uuid REFERENCES public.uffici(id),
  descrizione text NOT NULL,
  gravita text NOT NULL DEFAULT 'media',
  stato text NOT NULL DEFAULT 'aperta',
  risolta_da uuid REFERENCES public.profiles(id),
  note_risoluzione text,
  data_risoluzione timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for gravita + stato
CREATE OR REPLACE FUNCTION public.validate_anomalie_sistema()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.gravita NOT IN ('media','alta','critica') THEN
    RAISE EXCEPTION 'Invalid gravita: %', NEW.gravita;
  END IF;
  IF NEW.stato NOT IN ('aperta','in_verifica','risolta') THEN
    RAISE EXCEPTION 'Invalid stato: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_anomalie_sistema
BEFORE INSERT OR UPDATE ON public.anomalie_sistema
FOR EACH ROW EXECUTE FUNCTION public.validate_anomalie_sistema();

-- Indexes
CREATE INDEX idx_anomalie_sistema_stato ON public.anomalie_sistema(stato);
CREATE INDEX idx_anomalie_sistema_gravita ON public.anomalie_sistema(gravita);
CREATE INDEX idx_anomalie_sistema_tipo ON public.anomalie_sistema(tipo);
CREATE INDEX idx_anomalie_sistema_ufficio ON public.anomalie_sistema(ufficio_id);
CREATE UNIQUE INDEX idx_anomalie_no_duplicati ON public.anomalie_sistema(tipo, entita_tipo, entita_id) WHERE stato != 'risolta';

-- RLS
ALTER TABLE public.anomalie_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all anomalie" ON public.anomalie_sistema
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CFO select anomalie" ON public.anomalie_sistema
FOR SELECT USING (has_role(auth.uid(), 'cfo'::app_role));

CREATE POLICY "Ufficio select own anomalie" ON public.anomalie_sistema
FOR SELECT USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

CREATE POLICY "Ufficio update own anomalie" ON public.anomalie_sistema
FOR UPDATE USING (has_role(auth.uid(), 'ufficio'::app_role) AND ufficio_id = get_my_ufficio_id());

-- ============================================
-- 2) FUNZIONE run_data_quality_checks()
-- ============================================
CREATE OR REPLACE FUNCTION public.run_data_quality_checks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cnt_a int := 0;
  cnt_b int := 0;
  cnt_c int := 0;
  cnt_d int := 0;
  cnt_e int := 0;
  cnt_f int := 0;
  cnt_g int := 0;
  cnt_h int := 0;
BEGIN
  -- A) Titolo incassato senza movimento contabile
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'titolo_senza_movimento', 'titolo', t.id, t.ufficio_id,
    'Titolo ' || COALESCE(t.numero_titolo, t.id::text) || ' incassato senza movimento contabile collegato',
    'alta'
  FROM titoli t
  WHERE t.stato = 'incassato'
    AND NOT EXISTS (SELECT 1 FROM movimenti_contabili mc WHERE mc.riferimento_id = t.id AND mc.riferimento_tipo = 'titolo')
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'titolo_senza_movimento' AND a.entita_id = t.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_a = ROW_COUNT;

  -- B) Titolo incassato senza provvigione
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'titolo_senza_provvigione', 'titolo', t.id, t.ufficio_id,
    'Titolo ' || COALESCE(t.numero_titolo, t.id::text) || ' incassato senza provvigione generata',
    'alta'
  FROM titoli t
  WHERE t.stato = 'incassato'
    AND NOT EXISTS (SELECT 1 FROM provvigioni_generate pg WHERE pg.titolo_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'titolo_senza_provvigione' AND a.entita_id = t.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_b = ROW_COUNT;

  -- C) Provvigione senza regola matrice attiva
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'provvigione_senza_matrice', 'provvigione', pg.id, t.ufficio_id,
    'Provvigione per titolo ' || COALESCE(t.numero_titolo, t.id::text) || ' senza regola matrice attiva',
    'media'
  FROM provvigioni_generate pg
  JOIN titoli t ON t.id = pg.titolo_id
  WHERE NOT EXISTS (
    SELECT 1 FROM matrice_provvigioni mp
    WHERE mp.prodotto_id = t.prodotto_id AND mp.attiva = true
  )
  AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'provvigione_senza_matrice' AND a.entita_id = pg.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_c = ROW_COUNT;

  -- D) Sinistro senza titolo collegato
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'sinistro_senza_titolo', 'sinistro', s.id, s.ufficio_id,
    'Sinistro ' || COALESCE(s.numero_sinistro, s.id::text) || ' senza titolo collegato',
    'media'
  FROM sinistri s
  WHERE s.titolo_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'sinistro_senza_titolo' AND a.entita_id = s.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_d = ROW_COUNT;

  -- E) Sinistro chiuso con checklist obbligatorie non completate
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'sinistro_chiuso_incompleto', 'sinistro', s.id, s.ufficio_id,
    'Sinistro ' || COALESCE(s.numero_sinistro, s.id::text) || ' chiuso con checklist obbligatorie incomplete',
    'critica'
  FROM sinistri s
  WHERE s.stato = 'chiuso'
    AND EXISTS (SELECT 1 FROM sinistro_checklist sc WHERE sc.sinistro_id = s.id AND sc.obbligatorio = true AND sc.completato = false)
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'sinistro_chiuso_incompleto' AND a.entita_id = s.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_e = ROW_COUNT;

  -- F) Rimessa con totale diverso dalla somma dettaglio
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'rimessa_totale_errato', 'rimessa', rp.id, rp.ufficio_id,
    'Rimessa ' || rp.id::text || ': totale (' || COALESCE(rp.totale_importi,0) || ') diverso dalla somma dettaglio (' || COALESCE(somma,0) || ')',
    'alta'
  FROM rimessa_premi rp
  LEFT JOIN (SELECT rimessa_id, SUM(importo) AS somma FROM rimessa_dettaglio GROUP BY rimessa_id) rd ON rd.rimessa_id = rp.id
  WHERE ABS(COALESCE(rp.totale_importi,0) - COALESCE(rd.somma,0)) > 0.01
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'rimessa_totale_errato' AND a.entita_id = rp.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_f = ROW_COUNT;

  -- G) Estratto conto OK senza incrocio bancario
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'estratto_ok_senza_match', 'estratto_conto', ec.id, ec.ufficio_id,
    'Estratto conto del ' || ec.data_operazione || ' (€' || ec.importo || ') stato OK senza incrocio bancario',
    'media'
  FROM estratti_conto ec
  WHERE ec.stato = 'ok'
    AND NOT EXISTS (SELECT 1 FROM incroci_bancari ib WHERE ib.estratto_id = ec.id)
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'estratto_ok_senza_match' AND a.entita_id = ec.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_g = ROW_COUNT;

  -- H) Cliente senza consenso obbligatorio attivo
  INSERT INTO anomalie_sistema (tipo, entita_tipo, entita_id, ufficio_id, descrizione, gravita)
  SELECT 'cliente_senza_consenso', 'cliente', p.id, p.ufficio_id,
    'Cliente ' || COALESCE(p.cognome,'') || ' ' || COALESCE(p.nome,'') || ' senza consenso trattamento dati attivo',
    'critica'
  FROM profiles p
  WHERE p.ruolo = 'cliente' AND p.attivo = true
    AND NOT EXISTS (
      SELECT 1 FROM privacy_consensi pc
      WHERE pc.cliente_id = p.id AND pc.tipo_consenso = 'trattamento_dati' AND pc.stato = 'dato'
    )
    AND NOT EXISTS (SELECT 1 FROM anomalie_sistema a WHERE a.tipo = 'cliente_senza_consenso' AND a.entita_id = p.id AND a.stato != 'risolta');
  GET DIAGNOSTICS cnt_h = ROW_COUNT;

  RETURN json_build_object(
    'titolo_senza_movimento', cnt_a,
    'titolo_senza_provvigione', cnt_b,
    'provvigione_senza_matrice', cnt_c,
    'sinistro_senza_titolo', cnt_d,
    'sinistro_chiuso_incompleto', cnt_e,
    'rimessa_totale_errato', cnt_f,
    'estratto_ok_senza_match', cnt_g,
    'cliente_senza_consenso', cnt_h,
    'totale_nuove', cnt_a+cnt_b+cnt_c+cnt_d+cnt_e+cnt_f+cnt_g+cnt_h
  );
END;
$$;
