
-- Trend mensile premi/provvigioni/margine ultimi 24 mesi
CREATE OR REPLACE FUNCTION public.cfo_trend_mensile(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT to_char(date_trunc('month', t.data_incasso), 'YYYY-MM') AS mese,
      SUM(t.importo_incassato) AS premi,
      COALESCE(SUM(pg.importo_provvigione),0) AS provvigioni,
      SUM(t.importo_incassato) - COALESCE(SUM(pg.importo_provvigione),0) AS margine
    FROM titoli t
    LEFT JOIN provvigioni_generate pg ON pg.titolo_id = t.id
    WHERE t.stato='incassato' AND t.data_incasso IS NOT NULL
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
      AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    GROUP BY 1 ORDER BY 1
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Year-over-Year per mese
CREATE OR REPLACE FUNCTION public.cfo_yoy_mensile(
  _ufficio_id uuid DEFAULT NULL, _compagnia_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT to_char(t.data_incasso,'MM') AS mese,
      SUM(CASE WHEN EXTRACT(YEAR FROM t.data_incasso)=EXTRACT(YEAR FROM CURRENT_DATE) THEN t.importo_incassato ELSE 0 END) AS anno_corrente,
      SUM(CASE WHEN EXTRACT(YEAR FROM t.data_incasso)=EXTRACT(YEAR FROM CURRENT_DATE)-1 THEN t.importo_incassato ELSE 0 END) AS anno_precedente
    FROM titoli t
    WHERE t.stato='incassato' AND t.data_incasso IS NOT NULL
      AND EXTRACT(YEAR FROM t.data_incasso) IN (EXTRACT(YEAR FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)-1)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
    GROUP BY 1 ORDER BY 1
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Top clienti per premi
CREATE OR REPLACE FUNCTION public.cfo_top_clienti(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _compagnia_id uuid DEFAULT NULL,
  _limit integer DEFAULT 20
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT COALESCE(NULLIF(TRIM(c.ragione_sociale),''), TRIM(c.cognome||' '||c.nome)) AS cliente,
      SUM(t.importo_incassato) AS premi,
      COUNT(t.id) AS num_polizze,
      COALESCE(SUM(pg.importo_provvigione),0) AS provvigioni,
      SUM(t.importo_incassato) - COALESCE(SUM(pg.importo_provvigione),0) AS margine
    FROM titoli t
    JOIN clienti c ON c.id = t.cliente_id
    LEFT JOIN provvigioni_generate pg ON pg.titolo_id = t.id
    WHERE t.stato='incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
    GROUP BY c.id, c.ragione_sociale, c.cognome, c.nome
    ORDER BY premi DESC NULLS LAST
    LIMIT _limit
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Distribuzione clienti per fascia premio
CREATE OR REPLACE FUNCTION public.cfo_distribuzione_clienti_fascia(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    WITH per_cliente AS (
      SELECT cliente_id, SUM(importo_incassato) AS tot
      FROM titoli WHERE stato='incassato'
        AND (_data_da IS NULL OR data_incasso >= _data_da)
        AND (_data_a IS NULL OR data_incasso <= _data_a)
      GROUP BY cliente_id
    )
    SELECT fascia, COUNT(*) AS clienti FROM (
      SELECT CASE
        WHEN tot < 500 THEN '1. < 500€'
        WHEN tot < 2000 THEN '2. 500-2k€'
        WHEN tot < 10000 THEN '3. 2k-10k€'
        WHEN tot < 50000 THEN '4. 10k-50k€'
        ELSE '5. > 50k€' END AS fascia
      FROM per_cliente
    ) f GROUP BY fascia ORDER BY fascia
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Premio medio per ramo
CREATE OR REPLACE FUNCTION public.cfo_premio_medio_ramo(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _compagnia_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT ra.descrizione AS ramo,
      AVG(t.importo_incassato)::numeric(14,2) AS premio_medio,
      COUNT(t.id) AS num_polizze,
      SUM(t.importo_incassato) AS totale
    FROM titoli t JOIN rami ra ON ra.id=t.ramo_id
    WHERE t.stato='incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
      AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
    GROUP BY ra.descrizione
    ORDER BY premio_medio DESC LIMIT 20
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Premio medio per compagnia
CREATE OR REPLACE FUNCTION public.cfo_premio_medio_compagnia(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT co.nome AS compagnia,
      AVG(t.importo_incassato)::numeric(14,2) AS premio_medio,
      COUNT(t.id) AS num_polizze
    FROM titoli t JOIN compagnie co ON co.id=t.compagnia_id
    WHERE t.stato='incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
      AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
    GROUP BY co.nome
    ORDER BY premio_medio DESC LIMIT 20
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Distribuzione stati polizze
CREATE OR REPLACE FUNCTION public.cfo_distribuzione_stati(
  _ufficio_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT stato, COUNT(*) AS num, SUM(importo_incassato) AS totale
    FROM titoli
    WHERE (_ufficio_id IS NULL OR ufficio_id = _ufficio_id)
    GROUP BY stato ORDER BY num DESC
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Matrice sede × compagnia
CREATE OR REPLACE FUNCTION public.cfo_matrice_sede_compagnia(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT u.nome_ufficio AS sede, co.nome AS compagnia, SUM(t.importo_incassato) AS totale
    FROM titoli t
    JOIN uffici u ON u.id=t.ufficio_id
    JOIN compagnie co ON co.id=t.compagnia_id
    WHERE t.stato='incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
    GROUP BY u.nome_ufficio, co.nome
    ORDER BY totale DESC LIMIT 100
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Matrice produttore × ramo
CREATE OR REPLACE FUNCTION public.cfo_matrice_produttore_ramo(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT t.produttore_nome AS produttore, ra.descrizione AS ramo, SUM(t.importo_incassato) AS totale
    FROM titoli t JOIN rami ra ON ra.id=t.ramo_id
    WHERE t.stato='incassato' AND t.produttore_nome IS NOT NULL
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
    GROUP BY t.produttore_nome, ra.descrizione
    ORDER BY totale DESC LIMIT 100
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Loss ratio per ramo (sinistri liquidati+riserva / premi incassati)
CREATE OR REPLACE FUNCTION public.cfo_loss_ratio_ramo(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT ra.descrizione AS ramo,
      COALESCE(SUM(t.importo_incassato),0) AS premi,
      COALESCE((
        SELECT SUM(COALESCE(s.importo_liquidato,0)+COALESCE(s.importo_riserva,0))
        FROM sinistri s JOIN titoli t2 ON t2.id=s.titolo_id
        WHERE t2.ramo_id=ra.id
          AND (_data_da IS NULL OR s.data_apertura >= _data_da)
          AND (_data_a IS NULL OR s.data_apertura <= _data_a)
      ),0) AS sinistri_costo,
      CASE WHEN COALESCE(SUM(t.importo_incassato),0)>0
        THEN (COALESCE((SELECT SUM(COALESCE(s.importo_liquidato,0)+COALESCE(s.importo_riserva,0))
              FROM sinistri s JOIN titoli t2 ON t2.id=s.titolo_id WHERE t2.ramo_id=ra.id
              AND (_data_da IS NULL OR s.data_apertura >= _data_da)
              AND (_data_a IS NULL OR s.data_apertura <= _data_a)),0)
              / SUM(t.importo_incassato) * 100)::numeric(8,2)
        ELSE 0 END AS loss_ratio_pct
    FROM rami ra
    LEFT JOIN titoli t ON t.ramo_id=ra.id AND t.stato='incassato'
      AND (_data_da IS NULL OR t.data_incasso >= _data_da)
      AND (_data_a IS NULL OR t.data_incasso <= _data_a)
    GROUP BY ra.id, ra.descrizione
    HAVING COALESCE(SUM(t.importo_incassato),0)>0
    ORDER BY loss_ratio_pct DESC LIMIT 20
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Età sinistri aperti
CREATE OR REPLACE FUNCTION public.cfo_eta_sinistri_aperti()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT fascia, COUNT(*) AS num FROM (
      SELECT CASE
        WHEN CURRENT_DATE - data_apertura <= 30 THEN '0-30 giorni'
        WHEN CURRENT_DATE - data_apertura <= 90 THEN '31-90 giorni'
        WHEN CURRENT_DATE - data_apertura <= 180 THEN '91-180 giorni'
        ELSE '180+ giorni' END AS fascia
      FROM sinistri WHERE stato NOT IN ('chiuso','liquidato') AND data_apertura IS NOT NULL
    ) f GROUP BY fascia ORDER BY fascia
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;

-- Sinistri per compagnia
CREATE OR REPLACE FUNCTION public.cfo_sinistri_per_compagnia(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r json;
BEGIN
  SELECT json_agg(row_to_json(x)) INTO r FROM (
    SELECT co.nome AS compagnia, COUNT(s.id) AS num_sinistri,
      COALESCE(SUM(s.importo_liquidato),0) AS liquidato,
      COALESCE(SUM(s.importo_riserva),0) AS riserva
    FROM sinistri s JOIN compagnie co ON co.id=s.compagnia_id
    WHERE (_data_da IS NULL OR s.data_apertura >= _data_da)
      AND (_data_a IS NULL OR s.data_apertura <= _data_a)
    GROUP BY co.nome ORDER BY num_sinistri DESC LIMIT 15
  ) x;
  RETURN COALESCE(r,'[]'::json);
END;$$;
