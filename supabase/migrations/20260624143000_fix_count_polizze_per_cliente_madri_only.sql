-- Conteggio polizze per cliente: solo madri (sostituisce_polizza IS NULL), non quietanze.
-- Allineato a computeCounts in polizzeClienteView.ts / vista Polizze del ClienteDetail.

CREATE OR REPLACE FUNCTION public.count_polizze_per_cliente()
RETURNS TABLE(cliente_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT cliente_anagrafica_id, COUNT(*)
  FROM titoli
  WHERE cliente_anagrafica_id IS NOT NULL
    AND sostituisce_polizza IS NULL
  GROUP BY cliente_anagrafica_id
$$;

-- Stessa semantica in find_clienti_duplicati (colonna num_polizze)
CREATE OR REPLACE FUNCTION public.find_clienti_duplicati()
RETURNS TABLE(
  cluster_key text,
  match_type text,
  confidenza text,
  cliente_id uuid,
  nome_completo text,
  codice_fiscale text,
  partita_iva text,
  tipo_cliente text,
  attivo boolean,
  merged_into uuid,
  num_polizze bigint,
  num_sinistri bigint,
  num_documenti bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT 
      c.id, c.nome, c.cognome, c.ragione_sociale, c.codice_fiscale, 
      c.partita_iva, c.tipo_cliente, c.attivo, c.merged_into, c.created_at,
      TRIM(BOTH ' ' FROM UPPER(REGEXP_REPLACE(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'') || ' ' || COALESCE(c.ragione_sociale,''), '\s+', ' ', 'g'))) AS nome_norm
    FROM public.clienti c
    WHERE c.merged_into IS NULL
  ),
  by_cf AS (
    SELECT UPPER(TRIM(codice_fiscale)) AS k, 'codice_fiscale' AS mt, 'alta' AS conf
    FROM base WHERE codice_fiscale IS NOT NULL AND TRIM(codice_fiscale) <> ''
    GROUP BY UPPER(TRIM(codice_fiscale)) HAVING COUNT(*) > 1
  ),
  by_piva AS (
    SELECT TRIM(partita_iva) AS k, 'partita_iva' AS mt, 'alta' AS conf
    FROM base WHERE partita_iva IS NOT NULL AND TRIM(partita_iva) <> ''
    GROUP BY TRIM(partita_iva) HAVING COUNT(*) > 1
  ),
  by_name AS (
    SELECT nome_norm AS k, 'nome_cognome' AS mt, 'media' AS conf
    FROM base 
    WHERE (codice_fiscale IS NULL OR TRIM(codice_fiscale) = '')
      AND nome_norm <> '' AND LENGTH(nome_norm) > 3
    GROUP BY nome_norm HAVING COUNT(*) > 1
  ),
  matched AS (
    SELECT b.id, 'CF:' || cf.k AS cluster_key, cf.mt, cf.conf
    FROM base b JOIN by_cf cf ON UPPER(TRIM(b.codice_fiscale)) = cf.k
    UNION ALL
    SELECT b.id, 'PIVA:' || pv.k, pv.mt, pv.conf
    FROM base b JOIN by_piva pv ON TRIM(b.partita_iva) = pv.k
    UNION ALL
    SELECT b.id, 'NAME:' || nm.k, nm.mt, nm.conf
    FROM base b JOIN by_name nm ON b.nome_norm = nm.k
    WHERE (b.codice_fiscale IS NULL OR TRIM(b.codice_fiscale) = '')
  )
  SELECT 
    m.cluster_key,
    m.mt,
    m.conf,
    c.id,
    TRIM(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'') || ' ' || COALESCE(c.ragione_sociale,''))::text,
    c.codice_fiscale,
    c.partita_iva,
    c.tipo_cliente,
    c.attivo,
    c.merged_into,
    (SELECT COUNT(*) FROM titoli t WHERE t.cliente_anagrafica_id = c.id AND t.sostituisce_polizza IS NULL),
    (SELECT COUNT(*) FROM sinistri s WHERE s.cliente_anagrafica_id = c.id),
    (SELECT COUNT(*) FROM documenti d WHERE d.entita_tipo = 'cliente' AND d.entita_id = c.id),
    c.created_at
  FROM matched m
  JOIN public.clienti c ON c.id = m.id
  ORDER BY m.cluster_key, c.created_at;
$$;
