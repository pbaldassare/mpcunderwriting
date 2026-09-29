
-- KPI aggregati CFO
CREATE OR REPLACE FUNCTION public.cfo_kpi(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totale_premi_incassati', COALESCE((
      SELECT SUM(importo_incassato) FROM titoli
      WHERE stato = 'incassato'
        AND (_data_da IS NULL OR data_incasso >= _data_da)
        AND (_data_a IS NULL OR data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
    ), 0),
    'totale_provvigioni_generate', COALESCE((
      SELECT SUM(pg.importo_provvigione) FROM provvigioni_generate pg
      JOIN titoli t ON t.id = pg.titolo_id
      WHERE (_data_da IS NULL OR t.data_incasso >= _data_da)
        AND (_data_a IS NULL OR t.data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
    ), 0),
    'totale_provvigioni_pagate', COALESCE((
      SELECT SUM(pg.importo_provvigione) FROM provvigioni_generate pg
      JOIN titoli t ON t.id = pg.titolo_id
      WHERE pg.pagata = true
        AND (_data_da IS NULL OR t.data_incasso >= _data_da)
        AND (_data_a IS NULL OR t.data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
    ), 0),
    'totale_entrate', COALESCE((
      SELECT SUM(importo) FROM movimenti_contabili
      WHERE tipo = 'entrata'
        AND (_data_da IS NULL OR data_movimento >= _data_da)
        AND (_data_a IS NULL OR data_movimento <= _data_a)
        AND (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
    ), 0),
    'totale_uscite', COALESCE((
      SELECT SUM(importo) FROM movimenti_contabili
      WHERE tipo = 'uscita'
        AND (_data_da IS NULL OR data_movimento >= _data_da)
        AND (_data_a IS NULL OR data_movimento <= _data_a)
        AND (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
    ), 0),
    'incroci_ko', COALESCE((
      SELECT COUNT(*) FROM incroci_bancari WHERE esito = 'ko' AND verificato = false
    ), 0),
    'sinistri_aperti', 0
  ) INTO result;
  RETURN result;
END;
$$;

-- Entrate vs Uscite mensili
CREATE OR REPLACE FUNCTION public.cfo_entrate_uscite_mensili(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      TO_CHAR(data_movimento, 'YYYY-MM') AS mese,
      SUM(CASE WHEN tipo = 'entrata' THEN importo ELSE 0 END) AS entrate,
      SUM(CASE WHEN tipo = 'uscita' THEN importo ELSE 0 END) AS uscite
    FROM movimenti_contabili
    WHERE (_data_da IS NULL OR data_movimento >= _data_da)
      AND (_data_a IS NULL OR data_movimento <= _data_a)
      AND (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
    GROUP BY TO_CHAR(data_movimento, 'YYYY-MM')
    ORDER BY mese
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Premi per Compagnia
CREATE OR REPLACE FUNCTION public.cfo_premi_per_compagnia(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      c.nome AS compagnia,
      SUM(t.importo_incassato) AS totale
    FROM titoli t
    JOIN prodotti p ON p.id = t.prodotto_id
    JOIN compagnie c ON c.id = p.compagnia_id
    WHERE t.stato = 'incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
    GROUP BY c.nome
    ORDER BY totale DESC
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Redditività per Ufficio
CREATE OR REPLACE FUNCTION public.cfo_redditivita_ufficio(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      u.nome_ufficio AS ufficio,
      COALESCE(SUM(CASE WHEN mc.tipo = 'entrata' THEN mc.importo ELSE 0 END), 0) AS entrate,
      COALESCE(SUM(CASE WHEN mc.tipo = 'uscita' THEN mc.importo ELSE 0 END), 0) AS uscite,
      COALESCE(SUM(CASE WHEN mc.tipo = 'entrata' THEN mc.importo ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mc.tipo = 'uscita' THEN mc.importo ELSE 0 END), 0) AS margine
    FROM uffici u
    LEFT JOIN movimenti_contabili mc ON mc.ufficio_id = u.id
      AND (_data_da IS NULL OR mc.data_movimento >= _data_da)
      AND (_data_a IS NULL OR mc.data_movimento <= _data_a)
    WHERE u.attivo = true
    GROUP BY u.nome_ufficio
    ORDER BY margine DESC
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Andamento Provvigioni mensili
CREATE OR REPLACE FUNCTION public.cfo_provvigioni_mensili(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      TO_CHAR(pg.calcolata_il, 'YYYY-MM') AS mese,
      SUM(pg.importo_provvigione) AS totale,
      SUM(CASE WHEN pg.pagata THEN pg.importo_provvigione ELSE 0 END) AS pagate,
      SUM(CASE WHEN NOT pg.pagata THEN pg.importo_provvigione ELSE 0 END) AS non_pagate
    FROM provvigioni_generate pg
    JOIN titoli t ON t.id = pg.titolo_id
    WHERE (_data_da IS NULL OR pg.calcolata_il >= (_data_da)::timestamptz)
      AND (_data_a IS NULL OR pg.calcolata_il <= (_data_a + interval '1 day')::timestamptz)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
    GROUP BY TO_CHAR(pg.calcolata_il, 'YYYY-MM')
    ORDER BY mese
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Provvigioni non pagate raggruppate per utente
CREATE OR REPLACE FUNCTION public.cfo_provvigioni_non_pagate()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      pg.user_id,
      p.nome,
      p.cognome,
      COUNT(*) AS num_provvigioni,
      SUM(pg.importo_provvigione) AS totale_non_pagato
    FROM provvigioni_generate pg
    JOIN profiles p ON p.id = pg.user_id
    WHERE pg.pagata = false
    GROUP BY pg.user_id, p.nome, p.cognome
    ORDER BY totale_non_pagato DESC
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Report dinamico titoli
CREATE OR REPLACE FUNCTION public.cfo_report_titoli(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      t.numero_titolo,
      t.stato,
      t.premio_lordo,
      t.importo_incassato,
      t.data_incasso,
      pr.nome_prodotto AS prodotto,
      c.nome AS compagnia,
      u.nome_ufficio AS ufficio,
      prod.nome || ' ' || prod.cognome AS produttore,
      cli.nome || ' ' || cli.cognome AS cliente
    FROM titoli t
    LEFT JOIN prodotti pr ON pr.id = t.prodotto_id
    LEFT JOIN compagnie c ON c.id = pr.compagnia_id
    LEFT JOIN uffici u ON u.id = t.ufficio_id
    LEFT JOIN profiles prod ON prod.id = t.produttore_id
    LEFT JOIN profiles cli ON cli.id = t.cliente_id
    WHERE (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR pr.compagnia_id = _compagnia_id)
      AND (_produttore_id IS NULL OR t.produttore_id = _produttore_id)
    ORDER BY t.data_incasso DESC NULLS LAST
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
