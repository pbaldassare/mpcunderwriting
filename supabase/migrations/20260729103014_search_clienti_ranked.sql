-- Ricerca clienti con ranking per rilevanza anagrafica (prima della paginazione).
-- SECURITY INVOKER: rispetta le policy RLS su public.clienti del chiamante.

CREATE OR REPLACE FUNCTION public.search_clienti_ranked(
  p_search text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH term AS (
    SELECT lower(trim(both FROM coalesce(p_search, ''))) AS t
  ),
  matched AS (
    SELECT c.*
    FROM public.clienti c
    CROSS JOIN term
    WHERE c.merged_into IS NULL
      AND term.t <> ''
      AND (
        c.nome ILIKE '%' || p_search || '%'
        OR c.cognome ILIKE '%' || p_search || '%'
        OR c.ragione_sociale ILIKE '%' || p_search || '%'
        OR c.codice_fiscale ILIKE '%' || p_search || '%'
        OR c.codice_fiscale_azienda ILIKE '%' || p_search || '%'
        OR c.partita_iva ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
        OR c.pec ILIKE '%' || p_search || '%'
        OR c.telefono ILIKE '%' || p_search || '%'
        OR c.citta_residenza ILIKE '%' || p_search || '%'
        OR c.citta_sede ILIKE '%' || p_search || '%'
        OR c.codice_ricerca ILIKE '%' || p_search || '%'
        OR c.codice_cliente ILIKE '%' || p_search || '%'
      )
  ),
  scored AS (
    SELECT
      m.*,
      CASE
        WHEN lower(trim(both FROM coalesce(m.citta_residenza, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.citta_sede, ''))) = term.t
          THEN 1
        WHEN lower(trim(both FROM coalesce(m.ragione_sociale, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.cognome, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.nome, ''))) = term.t
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.cognome, '') || ' ' || coalesce(m.nome, ''),
               '\s+', ' ', 'g'
             ))) = term.t
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.nome, '') || ' ' || coalesce(m.cognome, ''),
               '\s+', ' ', 'g'
             ))) = term.t
          THEN 2
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE term.t || '%'
          THEN 3
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE '%' || term.t || '%'
          THEN 4
        ELSE 5
      END AS relevance_score
    FROM matched m
    CROSS JOIN term
  ),
  page AS (
    SELECT
      (to_jsonb(s) - 'relevance_score') AS row_data,
      s.relevance_score,
      s.cognome,
      s.ragione_sociale
    FROM scored s
    ORDER BY
      s.relevance_score ASC,
      s.cognome ASC NULLS LAST,
      s.ragione_sociale ASC NULLS LAST
    LIMIT greatest(coalesce(p_limit, 25), 0)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT count(*)::bigint FROM scored),
    'data', coalesce(
      (
        SELECT jsonb_agg(
          p.row_data
          ORDER BY p.relevance_score ASC, p.cognome ASC NULLS LAST, p.ragione_sociale ASC NULLS LAST
        )
        FROM page p
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.search_clienti_ranked(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_clienti_ranked(text, integer, integer) TO authenticated;
