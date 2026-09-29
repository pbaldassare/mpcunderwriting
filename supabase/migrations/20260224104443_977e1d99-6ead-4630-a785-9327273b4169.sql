
-- Tabella report salvati
CREATE TABLE public.report_salvati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_report text NOT NULL DEFAULT 'titoli',
  filtri_json jsonb DEFAULT '{}'::jsonb,
  creato_da uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger validazione tipo
CREATE OR REPLACE FUNCTION public.validate_report_salvati()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.tipo_report NOT IN ('cfo','contabilita','sinistri','titoli','provvigioni','banca') THEN
    RAISE EXCEPTION 'Invalid tipo_report: %', NEW.tipo_report;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_report_salvati
BEFORE INSERT OR UPDATE ON public.report_salvati
FOR EACH ROW EXECUTE FUNCTION public.validate_report_salvati();

CREATE INDEX idx_report_salvati_creato_da ON public.report_salvati(creato_da);
CREATE INDEX idx_report_salvati_tipo ON public.report_salvati(tipo_report);

ALTER TABLE public.report_salvati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all report_salvati"
ON public.report_salvati FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO all report_salvati"
ON public.report_salvati FOR ALL TO authenticated
USING (has_role(auth.uid(), 'cfo'));

CREATE POLICY "User manage own report_salvati"
ON public.report_salvati FOR ALL TO authenticated
USING (creato_da = auth.uid())
WITH CHECK (creato_da = auth.uid());

-- ========= FUNZIONI REPORT SERVER-SIDE =========

-- 1) Report Titoli incassati
CREATE OR REPLACE FUNCTION public.report_titoli_incassati(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _compagnia_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT t.numero_titolo, t.stato, t.premio_lordo, t.importo_incassato, t.data_incasso,
      pr.nome_prodotto AS prodotto, c.nome AS compagnia, u.nome_ufficio AS ufficio,
      prod.cognome || ' ' || prod.nome AS produttore,
      cli.cognome || ' ' || cli.nome AS cliente
    FROM titoli t
    LEFT JOIN prodotti pr ON pr.id = t.prodotto_id
    LEFT JOIN compagnie c ON c.id = pr.compagnia_id
    LEFT JOIN uffici u ON u.id = t.ufficio_id
    LEFT JOIN profiles prod ON prod.id = t.produttore_id
    LEFT JOIN profiles cli ON cli.id = t.cliente_id
    WHERE t.stato = 'incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR pr.compagnia_id = _compagnia_id)
    ORDER BY t.data_incasso DESC NULLS LAST
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2) Report Provvigioni per produttore
CREATE OR REPLACE FUNCTION public.report_provvigioni_produttore(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _user_id uuid DEFAULT NULL, _solo_non_pagate boolean DEFAULT false
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT pg.id, pg.importo_provvigione, pg.percentuale, pg.pagata, pg.calcolata_il,
      t.numero_titolo, t.premio_lordo,
      pr.nome_prodotto AS prodotto,
      p.cognome || ' ' || p.nome AS produttore
    FROM provvigioni_generate pg
    JOIN titoli t ON t.id = pg.titolo_id
    LEFT JOIN prodotti pr ON pr.id = t.prodotto_id
    LEFT JOIN profiles p ON p.id = pg.user_id
    WHERE (_data_da IS NULL OR pg.calcolata_il >= _data_da::timestamptz)
      AND (_data_a IS NULL OR pg.calcolata_il <= (_data_a + interval '1 day')::timestamptz)
      AND (_user_id IS NULL OR pg.user_id = _user_id)
      AND (NOT _solo_non_pagate OR pg.pagata = false)
    ORDER BY pg.calcolata_il DESC
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 3) Report Contabilità entrate/uscite
CREATE OR REPLACE FUNCTION public.report_contabilita(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _categoria text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT mc.id, mc.data_movimento, mc.tipo, mc.importo, mc.categoria, mc.descrizione, mc.stato,
      u.nome_ufficio AS ufficio
    FROM movimenti_contabili mc
    LEFT JOIN uffici u ON u.id = mc.ufficio_id
    WHERE (_data_da IS NULL OR mc.data_movimento >= _data_da)
      AND (_data_a IS NULL OR mc.data_movimento <= _data_a)
      AND (_ufficio_id IS NULL OR mc.ufficio_id = _ufficio_id)
      AND (_categoria IS NULL OR mc.categoria = _categoria)
    ORDER BY mc.data_movimento DESC
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 4) Report Sinistri
CREATE OR REPLACE FUNCTION public.report_sinistri(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _stato text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT s.id, s.numero_sinistro, s.stato, s.data_apertura, s.data_chiusura, s.descrizione,
      c.nome AS compagnia, u.nome_ufficio AS ufficio,
      cli.cognome || ' ' || cli.nome AS cliente,
      resp.cognome || ' ' || resp.nome AS responsabile,
      (SELECT COUNT(*) FROM sinistro_eventi se WHERE se.sinistro_id = s.id AND se.stato = 'scaduto') AS eventi_scaduti
    FROM sinistri s
    LEFT JOIN compagnie c ON c.id = s.compagnia_id
    LEFT JOIN uffici u ON u.id = s.ufficio_id
    LEFT JOIN profiles cli ON cli.id = s.cliente_id
    LEFT JOIN profiles resp ON resp.id = s.responsabile_id
    WHERE (_data_da IS NULL OR s.data_apertura >= _data_da)
      AND (_data_a IS NULL OR s.data_apertura <= _data_a)
      AND (_ufficio_id IS NULL OR s.ufficio_id = _ufficio_id)
      AND (_stato IS NULL OR s.stato = _stato)
    ORDER BY s.data_apertura DESC
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5) Report Banca KO
CREATE OR REPLACE FUNCTION public.report_banca_ko(
  _ufficio_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT ib.id, ib.esito, ib.note, ib.differenza, ib.matching_metodo, ib.verificato, ib.created_at,
      ec.data_operazione, ec.importo AS importo_estratto, ec.descrizione AS desc_estratto,
      mc.data_movimento, mc.importo AS importo_movimento, mc.descrizione AS desc_movimento,
      EXTRACT(EPOCH FROM (now() - ib.created_at)) / 86400 AS giorni_apertura
    FROM incroci_bancari ib
    LEFT JOIN estratti_conto ec ON ec.id = ib.estratto_id
    LEFT JOIN movimenti_contabili mc ON mc.id = ib.movimento_id
    WHERE ib.esito = 'ko' AND ib.verificato = false
      AND (_ufficio_id IS NULL OR ec.ufficio_id = _ufficio_id OR mc.ufficio_id = _ufficio_id)
    ORDER BY ib.created_at DESC
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
