
-- 1. Fix cfo_premi_per_compagnia: direct JOIN titoli.compagnia_id → compagnie
CREATE OR REPLACE FUNCTION public.cfo_premi_per_compagnia(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT c.nome AS compagnia, SUM(t.importo_incassato) AS totale
    FROM titoli t
    JOIN compagnie c ON c.id = t.compagnia_id
    WHERE t.stato = 'incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
      AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    GROUP BY c.nome
    ORDER BY totale DESC
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2. Fix cfo_report_titoli: direct JOINs, use produttore_nome and cliente_anagrafica_id
CREATE OR REPLACE FUNCTION public.cfo_report_titoli(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      t.numero_titolo, t.stato, t.premio_lordo, t.importo_incassato, t.data_incasso,
      c.nome AS compagnia,
      ra.descrizione AS ramo,
      u.nome_ufficio AS ufficio,
      t.produttore_nome AS produttore,
      COALESCE(cli.ragione_sociale, cli.cognome || ' ' || cli.nome) AS cliente
    FROM titoli t
    LEFT JOIN compagnie c ON c.id = t.compagnia_id
    LEFT JOIN rami ra ON ra.id = t.ramo_id
    LEFT JOIN uffici u ON u.id = t.ufficio_id
    LEFT JOIN clienti cli ON cli.id = t.cliente_anagrafica_id
    WHERE (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
      AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    ORDER BY t.data_incasso DESC NULLS LAST
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 3. NEW: cfo_premi_per_ramo
CREATE OR REPLACE FUNCTION public.cfo_premi_per_ramo(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT ra.descrizione AS ramo, SUM(t.importo_incassato) AS totale
    FROM titoli t
    JOIN rami ra ON ra.id = t.ramo_id
    WHERE t.stato = 'incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
      AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    GROUP BY ra.descrizione
    ORDER BY totale DESC
    LIMIT 15
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 4. NEW: cfo_premi_per_produttore
CREATE OR REPLACE FUNCTION public.cfo_premi_per_produttore(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT t.produttore_nome AS produttore, SUM(t.importo_incassato) AS totale
    FROM titoli t
    WHERE t.stato = 'incassato'
      AND t.produttore_nome IS NOT NULL AND t.produttore_nome != ''
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
    GROUP BY t.produttore_nome
    ORDER BY totale DESC
    LIMIT 15
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5. Fix cfo_kpi to accept compagnia and produttore filters
CREATE OR REPLACE FUNCTION public.cfo_kpi(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'totale_premi_incassati', COALESCE((
      SELECT SUM(importo_incassato) FROM titoli
      WHERE stato = 'incassato'
        AND (_data_da IS NULL OR data_incasso >= _data_da)
        AND (_data_a IS NULL OR data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
        AND (_compagnia_id IS NULL OR compagnia_id = _compagnia_id)
        AND (_produttore_nome IS NULL OR produttore_nome = _produttore_nome)
    ), 0),
    'totale_provvigioni_generate', COALESCE((
      SELECT SUM(pg.importo_provvigione) FROM provvigioni_generate pg
      JOIN titoli t ON t.id = pg.titolo_id
      WHERE (_data_da IS NULL OR t.data_incasso >= _data_da)
        AND (_data_a IS NULL OR t.data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
        AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
        AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    ), 0),
    'totale_provvigioni_pagate', COALESCE((
      SELECT SUM(pg.importo_provvigione) FROM provvigioni_generate pg
      JOIN titoli t ON t.id = pg.titolo_id
      WHERE pg.pagata = true
        AND (_data_da IS NULL OR t.data_incasso >= _data_da)
        AND (_data_a IS NULL OR t.data_incasso <= _data_a)
        AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
        AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
        AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
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
